// Rescan comparison service (Bible §15/§77, master spec "Rescan comparison").
// Deterministic delta calculation against the stored baseline — the model/mock
// analysis only supplies fresh category evidence; this module decides what counts
// as a real change versus noise.

import { CATEGORY_LABELS, CategoryDelta, Comparison, Mission, Scan } from "@/lib/types/aura";
import { callCategoryChange, isMeaningfulOverallChange } from "@/lib/scoring";

export function buildComparison(baseline: Scan, current: Scan, missions: Mission[] = []): Comparison {
  if (!baseline.scoring || !current.scoring) {
    throw new Error("Both scans must be scored before comparison");
  }

  const comparabilityScore = Math.min(
    baseline.modelOutput?.scan_quality.comparability_score ?? 1,
    current.modelOutput?.scan_quality.comparability_score ?? 1
  );

  const missionByCategory = new Map(
    missions
      .filter((m) => m.sourceScanId === baseline.id && (m.status === "active" || m.status === "completed"))
      .map((m) => [m.category, m.title])
  );

  const categoryDeltas: CategoryDelta[] = baseline.scoring.categories.map((baseCat) => {
    const currentCat = current.scoring!.categories.find((c) => c.category === baseCat.category)!;
    const delta = currentCat.score - baseCat.score;
    const confidenceBoth = baseCat.confidence === "high" && currentCat.confidence === "high" ? "high" : "medium";
    return {
      category: baseCat.category,
      baselineScore: baseCat.score,
      currentScore: currentCat.score,
      delta,
      call: callCategoryChange(delta, confidenceBoth, comparabilityScore),
      attributedMissionTitle: missionByCategory.get(baseCat.category) ?? null,
    };
  });

  const overallDelta = current.scoring.overallScore - baseline.scoring.overallScore;
  const meaningfulOverall = isMeaningfulOverallChange(overallDelta, comparabilityScore);

  const improved = categoryDeltas
    .filter((d) => d.call === "confirmed_improvement" || d.call === "likely_improvement")
    .sort((a, b) => b.delta - a.delta);
  const declined = categoryDeltas.filter((d) => d.call === "declined").sort((a, b) => a.delta - b.delta);
  const notComparable = categoryDeltas.filter((d) => d.call === "not_comparable");

  const whatChanged: string[] = [];
  improved.slice(0, 3).forEach((d) => {
    // Correlational language only — a rescan can never prove a specific mission
    // caused a score change (too many uncontrolled variables between two photos
    // taken days apart). State it as consistency with the targeted change, not causation.
    const attribution = d.attributedMissionTitle
      ? ` This is consistent with the change targeted by your "${d.attributedMissionTitle}" mission — not proof it was the cause.`
      : "";
    whatChanged.push(
      `${CATEGORY_LABELS[d.category]} improved from ${d.baselineScore} to ${d.currentScore} (+${d.delta}).${attribution}`
    );
  });
  declined.forEach((d) => {
    whatChanged.push(
      `${CATEGORY_LABELS[d.category]} moved from ${d.baselineScore} to ${d.currentScore} (${d.delta}) — worth a look.`
    );
  });
  if (whatChanged.length === 0) {
    whatChanged.push(
      meaningfulOverall
        ? "Overall presentation moved, but no single category crossed the confidence threshold on its own."
        : "No category changed enough to be distinguished from normal photo-to-photo noise."
    );
  }

  const possibleNoise: string[] = [];
  categoryDeltas
    .filter((d) => d.call === "stable" && Math.abs(d.delta) > 0)
    .forEach((d) => possibleNoise.push(`${CATEGORY_LABELS[d.category]} moved by ${d.delta} — likely photo-condition noise, not real change.`));
  if (notComparable.length > 0) {
    possibleNoise.push(
      `${notComparable.map((d) => CATEGORY_LABELS[d.category]).join(", ")} could not be reliably compared — conditions were too different between scans.`
    );
  }

  return {
    id: crypto.randomUUID(),
    baselineScanId: baseline.id,
    currentScanId: current.id,
    comparabilityScore,
    overallDelta,
    categoryDeltas,
    whatChanged,
    possibleNoise,
    createdAt: new Date().toISOString(),
  };
}
