"use client";

import { use, useEffect } from "react";
import { CATEGORY_LABELS } from "@/lib/types/aura";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { OvrDial } from "@/components/aura/OvrDial";
import { FeedbackPrompt } from "@/components/aura/FeedbackPrompt";
import { getComparison, getScan, suggestedMissions } from "@/lib/store/auraStore";
import { track } from "@/lib/analytics/events";
import { useHydrated } from "@/lib/hooks/useHydrated";

const CALL_LABEL: Record<string, string> = {
  confirmed_improvement: "Improved",
  likely_improvement: "Likely improved",
  stable: "Stable",
  declined: "Declined",
  not_comparable: "Not comparable",
};

const CALL_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  confirmed_improvement: "success",
  likely_improvement: "success",
  stable: "neutral",
  declined: "danger",
  not_comparable: "warning",
};

export default function LevelUpPage(props: PageProps<"/level-up/[comparisonId]">) {
  const { comparisonId } = use(props.params);
  const hydrated = useHydrated();

  const comparison = hydrated ? getComparison(comparisonId) : null;
  const baseline = comparison ? getScan(comparison.baselineScanId) : null;
  const current = comparison ? getScan(comparison.currentScanId) : null;

  useEffect(() => {
    if (comparison) track("comparison_viewed", { comparisonId: comparison.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once when data becomes available
  }, [hydrated, comparisonId]);

  if (!hydrated) return null;
  if (!comparison || !baseline || !current) {
    return <div className="mx-auto max-w-lg px-5 py-16 text-center text-muted">We couldn&apos;t find that comparison.</div>;
  }

  const nextMission = suggestedMissions()[0] ?? null;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-8 px-5 py-10">
      <div className="text-center">
        <span className="text-xs uppercase tracking-[0.2em] text-accent-soft">Level Up</span>
        <div className="mt-4 flex items-center justify-center gap-6">
          <div className="text-center">
            <p className="text-xs text-muted">Baseline</p>
            <p className="text-3xl font-bold tabular-nums text-muted">{baseline.scoring!.overallScore}</p>
          </div>
          <span className="text-2xl text-muted">→</span>
          <OvrDial score={current.scoring!.overallScore} confidence={current.scoring!.overallConfidence} size={140} delta={comparison.overallDelta} />
        </div>
      </div>

      {comparison.comparabilityScore < 0.6 && (
        <Card className="border-warning/40 bg-warning/5 text-sm text-warning">
          Conditions between your two scans were quite different, so some of this comparison has lower confidence.
        </Card>
      )}

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted">Category changes</h2>
        <Card className="flex flex-col gap-3">
          {comparison.categoryDeltas.map((d, i) => (
            <div
              key={d.category}
              className="animate-fade-up flex items-center justify-between"
              style={{ animationDelay: `${150 + i * 70}ms` }}
            >
              <span className="text-sm">{CATEGORY_LABELS[d.category]}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted tabular-nums">
                  {d.baselineScore} → {d.currentScore}
                </span>
                <span
                  className={`text-xs font-medium ${
                    CALL_TONE[d.call] === "success" ? "text-success" : CALL_TONE[d.call] === "danger" ? "text-danger" : "text-muted"
                  }`}
                >
                  {CALL_LABEL[d.call]}
                </span>
              </div>
            </div>
          ))}
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted">What changed</h2>
        <Card className="flex flex-col gap-2 text-sm">
          {comparison.whatChanged.map((line, i) => (
            <p key={i}>• {line}</p>
          ))}
        </Card>
      </div>

      {comparison.possibleNoise.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-muted">Likely noise, not real change</h2>
          <Card className="flex flex-col gap-2 text-sm text-muted">
            {comparison.possibleNoise.map((line, i) => (
              <p key={i}>• {line}</p>
            ))}
          </Card>
        </div>
      )}

      {nextMission && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-muted">Next best upgrade</h2>
          <LinkButton href={`/missions/${nextMission.id}`} variant="secondary" className="!block !h-auto !py-4 text-left">
            <span className="block font-medium">{nextMission.title}</span>
            <span className="mt-1 block text-sm font-normal text-muted">{nextMission.action}</span>
          </LinkButton>
        </div>
      )}

      <FeedbackPrompt scanId={current.id} />

      <LinkButton href="/journey" size="lg">
        Back to Journey
      </LinkButton>
    </div>
  );
}
