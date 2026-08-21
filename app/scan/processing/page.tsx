"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { WizardShell } from "@/components/aura/WizardShell";
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
import { runMockAnalysis } from "@/lib/mock/mockAnalysis";
import { computeScoring } from "@/lib/scoring";
import { buildComparison } from "@/lib/scoring/compare";
import { AuraCategory, PendingImage } from "@/lib/types/aura";

const STAGES = [
  { key: "upload", label: "Securing your photos…" },
  { key: "extract", label: "Analyzing Hair, Style & Grooming…" },
  { key: "score", label: "Scoring your presentation…" },
  { key: "plan", label: "Building your upgrade plan…" },
] as const;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function ProcessingPage() {
  const router = useRouter();
  const [stageIndex, setStageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const ranRef = useRef(false);

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

      setStageIndex(0);
      await delay(500);

      setStageIndex(1);
      const usableCount = images.filter((i) => i.usable).length;
      const comparabilityScore = Math.min(1, 0.5 + 0.5 * (usableCount / images.length));
      const seedKey = images.map((i) => `${i.viewType}:${i.sizeBytes}:${i.width}x${i.height}`).join("|") + `|${draft.goal}`;

      const baseline = draft.scanType === "rescan" && draft.baselineScanId ? await baselineScan() : null;
      const activeMissionCategories: AuraCategory[] = [];
      if (baseline) {
        // Only boost categories the user actually started (or completed) a mission
        // for — not every original recommendation. A rescan should reflect what the
        // user chose to act on, not what Aura merely suggested (Bible §15: link
        // observed change to logged interventions, not blanket assumption).
        const allMissions = await listMissions();
        allMissions
          .filter((m) => m.sourceScanId === baseline.id && (m.status === "active" || m.status === "completed"))
          .forEach((m) => activeMissionCategories.push(m.category));
      }

      const modelOutput = runMockAnalysis({
        seedKey,
        goal: draft.goal ?? "overall_improvement",
        comparabilityScore,
        imageIssues: images.flatMap((i) => i.qualityFlags),
        baseline: baseline?.scoring ? { scoring: baseline.scoring, activeMissionCategories } : undefined,
      });
      await delay(600);

      setStageIndex(2);
      const scoring = computeScoring(modelOutput);
      await delay(500);

      setStageIndex(3);

      const scan = await createScan({
        scanType: draft.scanType,
        goal: draft.goal ?? "overall_improvement",
        baselineScanId: draft.scanType === "rescan" ? draft.baselineScanId : null,
        images,
        modelOutput,
        scoring,
        modelVersion: "mock-v0",
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
    <WizardShell step={5} title="Analyzing your scan" subtitle="This usually takes a few seconds.">
      <div className="flex flex-col gap-4">
        {STAGES.map((stage, i) => (
          <div key={stage.key} className="flex items-center gap-3">
            <div
              className={`h-2 w-2 rounded-full ${
                i < stageIndex ? "bg-success" : i === stageIndex ? "bg-accent animate-pulse" : "bg-surface-elevated"
              }`}
            />
            <span className={i <= stageIndex ? "text-foreground" : "text-muted"}>{stage.label}</span>
          </div>
        ))}

        {error === "unrecoverable" && (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-danger/10 p-4 text-sm text-danger">
            <span>Your photos weren&apos;t found — this can happen after a page refresh. Please upload again.</span>
            <button
              onClick={() => router.push("/scan/upload")}
              className="self-start rounded-full bg-danger/20 px-4 py-2 text-xs font-medium hover:bg-danger/30"
            >
              Back to upload
            </button>
          </div>
        )}

        {error === "retryable" && (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-danger/10 p-4 text-sm text-danger">
            <span>Something went wrong while analyzing your photos.</span>
            <button
              onClick={() => {
                ranRef.current = false;
                run();
              }}
              className="self-start rounded-full bg-danger/20 px-4 py-2 text-xs font-medium hover:bg-danger/30"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </WizardShell>
  );
}
