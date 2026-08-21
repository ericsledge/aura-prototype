"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics/events";
import {
  awardXp,
  baselineScan,
  clearDraft,
  createScan,
  getDraft,
  listMissions,
  listScans,
  queueMissionsFromScan,
  saveComparison,
} from "@/lib/store/auraStore";
import { requestAnalysis } from "@/lib/ai/client";
import { runMockAnalysis } from "@/lib/mock/mockAnalysis";
import { computeScoring } from "@/lib/scoring";
import { buildComparison } from "@/lib/scoring/compare";
import { AuraModelOutput, PendingImage } from "@/lib/types/aura";

// Real AI takes anywhere from a few seconds to ~15s — no fixed schedule of
// fake stages/percentages to promise a timeline we don't control. These
// rotate on their own clock, independent of how long the actual call takes.
const ROTATING_MESSAGES = [
  "Analyzing your build…",
  "Checking Face, Hair, Style, Physique, Presence and Details…",
  "Separating scan quality from your Aura score…",
  "Building your upgrade plan…",
];
const MESSAGE_INTERVAL_MS = 2600;

/**
 * Real AI is the only path in production (OPENAI_API_KEY is always set on
 * Vercel). The mock is kept as a local-dev-only fallback for contributors who
 * haven't configured a key — never as a fallback for a real API failure, which
 * would silently misrepresent a live scan as AI-scored when it wasn't.
 */
async function getModelOutput(
  images: PendingImage[],
  goal: NonNullable<ReturnType<typeof getDraft>["goal"]>,
  comparabilityScore: number,
  seedKey: string
): Promise<{ modelOutput: AuraModelOutput; model: string }> {
  try {
    return await requestAnalysis(
      images.map((i) => ({ viewType: i.viewType, dataUrl: i.dataUrl })),
      goal
    );
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("ai_not_configured")) {
      console.warn("[aura] OPENAI_API_KEY not set — using mock analysis for local development only.");
      const modelOutput = runMockAnalysis({
        seedKey,
        goal,
        comparabilityScore,
        imageIssues: images.flatMap((i) => i.qualityFlags),
      });
      return { modelOutput, model: "mock-v0" };
    }
    throw e;
  }
}

export default function ProcessingPage() {
  const router = useRouter();
  const [messageIndex, setMessageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % ROTATING_MESSAGES.length);
    }, MESSAGE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run() {
    setError(null);
    try {
      track("scan_analysis_started");

      const raw = sessionStorage.getItem("aura.pendingScanImages");
      if (!raw) throw new Error("missing_images");
      const images = JSON.parse(raw) as PendingImage[];
      const draft = getDraft();

      const usableCount = images.filter((i) => i.usable).length;
      const comparabilityScore = Math.min(1, 0.5 + 0.5 * (usableCount / images.length));
      const seedKey = images.map((i) => `${i.viewType}:${i.sizeBytes}:${i.width}x${i.height}`).join("|") + `|${draft.goal}`;

      // Still needed for rescan comparison later — real AI assesses the new
      // photos entirely on their own merits, with no artificial boost toward
      // "improvement." Only the mock's local-dev fallback ever biased scores
      // toward active missions, and only because it has no real photos to look at.
      const baseline = draft.scanType === "rescan" && draft.baselineScanId ? await baselineScan() : null;

      const { modelOutput, model } = await getModelOutput(images, draft.goal ?? "overall_improvement", comparabilityScore, seedKey);

      // A capture problem is not character progression — an unusable scan
      // never becomes a real baseline/rescan, never awards XP, and never
      // enters scan history as if it were a real measurement.
      if (!modelOutput.scan_quality.usable || modelOutput.scan_quality.rating === "retake") {
        sessionStorage.setItem("aura.retakeIssues", JSON.stringify(modelOutput.scan_quality.issues));
        sessionStorage.removeItem("aura.pendingScanImages");
        track("scan_quality_retake_needed", { issues: modelOutput.scan_quality.issues });
        router.push("/scan/retake-needed");
        return;
      }

      const scoring = computeScoring(modelOutput);

      const scan = await createScan({
        scanType: draft.scanType,
        goal: draft.goal ?? "overall_improvement",
        baselineScanId: draft.scanType === "rescan" ? draft.baselineScanId : null,
        images,
        modelOutput,
        scoring,
        modelVersion: model,
      });
      await queueMissionsFromScan(scan);
      sessionStorage.removeItem("aura.pendingScanImages");

      track("scan_analysis_completed", { scanId: scan.id, ovr: scoring.overallScore, scanType: scan.scanType });

      const totalScans = (await listScans()).length;
      if (totalScans === 1) track("first_scan_completed");
      if (totalScans === 2) track("second_scan_completed");
      if (totalScans === 3) track("third_scan_completed");

      if (draft.scanType === "rescan" && baseline) {
        const allMissions = await listMissions();
        const comparison = await saveComparison(buildComparison(baseline, scan, allMissions));
        track("rescan_completed", { comparisonId: comparison.id });

        if (comparison.comparabilityScore >= 0.55) {
          await awardXp("valid_comparison_scan");
        }
        const anyConfirmedImprovement = comparison.categoryDeltas.some(
          (d) => d.call === "confirmed_improvement" || d.call === "likely_improvement"
        );
        if (anyConfirmedImprovement) {
          await awardXp("first_confirmed_improvement", "bonus:first_confirmed_improvement");
        }
        if (scoring.overallScore - baseline.scoring!.overallScore >= 5) {
          await awardXp("plus5_from_baseline", "bonus:plus5_from_baseline");
        }

        clearDraft();
        router.push(`/level-up/${comparison.id}`);
      } else {
        clearDraft();
        router.push(`/scan/reveal/${scan.id}`);
      }
    } catch (e) {
      if (e instanceof Error && e.message === "missing_images") {
        setError("unrecoverable");
      } else {
        setError("retryable");
      }
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-8 px-5 py-10 text-center">
      <div className="relative flex h-40 w-40 items-center justify-center">
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-border-subtle border-t-accent" style={{ animationDuration: "1.6s" }} />
        <span className="text-xs uppercase tracking-[0.2em] text-muted">Aura</span>
      </div>

      <p key={messageIndex} className="animate-fade-up max-w-sm text-lg font-medium">
        {ROTATING_MESSAGES[messageIndex]}
      </p>

      {error === "unrecoverable" && (
        <div className="flex flex-col gap-3 rounded-2xl bg-danger/10 p-4 text-sm text-danger">
          <span>Your photos weren&apos;t found — this can happen after a page refresh. Please upload again.</span>
          <button
            onClick={() => router.push("/scan/upload")}
            className="self-center rounded-full bg-danger/20 px-4 py-2 text-xs font-medium hover:bg-danger/30"
          >
            Back to upload
          </button>
        </div>
      )}

      {error === "retryable" && (
        <div className="flex flex-col gap-3 rounded-2xl bg-danger/10 p-4 text-sm text-danger">
          <span>Something went wrong while analyzing your photos.</span>
          <button
            onClick={() => {
              ranRef.current = false;
              run();
            }}
            className="self-center rounded-full bg-danger/20 px-4 py-2 text-xs font-medium hover:bg-danger/30"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
