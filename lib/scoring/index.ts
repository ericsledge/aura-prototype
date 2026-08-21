// Deterministic scoring service.
//
// Per the Bible (§13, §76): the model only outputs category evidence + provisional
// subscores. This module owns the actual arithmetic that turns that into a final
// OVR, so scoring behavior is reproducible and auditable independent of model
// sampling noise. Never let a free-form model response invent the final number.

import {
  AURA_CATEGORIES,
  AuraCategory,
  AuraModelOutput,
  CategoryScore,
  Confidence,
  ScoringResult,
} from "@/lib/types/aura";

export const RUBRIC_VERSION = "aura-rubric-v0.1";
export const SCORING_VERSION = "aura-scoring-v0.1";

// Equal-ish starting weights per §13/§76 ("start with equal-ish weights, then test
// whether user goals should alter emphasis"). Kept as a frozen, versioned constant
// rather than left to the model.
const CATEGORY_WEIGHTS: Record<AuraCategory, number> = {
  hair: 0.16,
  facial_hair: 0.1,
  skin_grooming: 0.14,
  style: 0.22,
  accessories: 0.08,
  physique_presentation: 0.16,
  photo_presence: 0.14,
};

const CONFIDENCE_PENALTY: Record<Confidence, number> = {
  high: 1,
  medium: 0.97,
  low: 0.92,
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Overall confidence is driven by comparability first, then how many
 * categories individually landed low — NOT the single worst category.
 * A strict "weakest link" rule was previously used here and made overall
 * confidence read "low" on nearly every scan (with 7 independent per-category
 * rolls, the odds that *at least one* lands low are high even when the input
 * is perfectly comparable) — technically defensible but functionally
 * indistinguishable from "always low," which trains users to ignore the
 * confidence label entirely. A few individually-uncertain categories no
 * longer sink the whole scan; genuinely widespread uncertainty still does.
 */
function combineConfidence(categories: Confidence[], comparabilityScore: number): Confidence {
  if (comparabilityScore < 0.55) return "low";

  const lowCount = categories.filter((c) => c === "low").length;
  const highCount = categories.filter((c) => c === "high").length;

  if (lowCount >= 3) return "low";
  if (lowCount <= 1 && highCount >= 4) return "high";
  return "medium";
}

/**
 * Computes final category scores and OVR from raw model evidence.
 * Deterministic: identical input always yields identical output.
 */
export function computeScoring(model: AuraModelOutput): ScoringResult {
  const categories: CategoryScore[] = AURA_CATEGORIES.map((cat) => {
    const raw = model.categories.find((c) => c.name === cat);
    if (!raw) {
      return {
        category: cat,
        score: 60,
        confidence: "low" as Confidence,
        evidence: [],
        controllableFactors: [],
      };
    }
    const penalty = CONFIDENCE_PENALTY[raw.confidence];
    const comparabilityPenalty = 0.85 + 0.15 * model.scan_quality.comparability_score;
    const score = clamp(Math.round(raw.provisional_score * penalty * comparabilityPenalty), 0, 100);
    return {
      category: cat,
      score,
      confidence: raw.confidence,
      evidence: raw.evidence,
      controllableFactors: raw.controllable_factors,
    };
  });

  const weightedSum = categories.reduce((sum, c) => sum + c.score * CATEGORY_WEIGHTS[c.category], 0);
  const totalWeight = categories.reduce((sum, c) => sum + CATEGORY_WEIGHTS[c.category], 0);
  const overallScore = clamp(Math.round(weightedSum / totalWeight), 0, 100);

  const overallConfidence = combineConfidence(
    categories.map((c) => c.confidence),
    model.scan_quality.comparability_score
  );

  return {
    overallScore,
    overallConfidence,
    categories,
    scoringVersion: SCORING_VERSION,
    rubricVersion: RUBRIC_VERSION,
  };
}

// ---- Rescan comparison (§15, §77) ----

const NOISE_THRESHOLD = 3; // OVR points; below this we call it "stable", not a level-up
const CATEGORY_NOISE_THRESHOLD = 5;

export type ChangeCallResult = "confirmed_improvement" | "likely_improvement" | "stable" | "declined" | "not_comparable";

export function callCategoryChange(
  delta: number,
  confidenceBoth: Confidence,
  comparabilityScore: number
): ChangeCallResult {
  if (comparabilityScore < 0.55) return "not_comparable";
  const threshold = confidenceBoth === "high" ? CATEGORY_NOISE_THRESHOLD - 2 : CATEGORY_NOISE_THRESHOLD;
  if (Math.abs(delta) < threshold) return "stable";
  if (delta > 0) return confidenceBoth === "low" ? "likely_improvement" : "confirmed_improvement";
  return "declined";
}

export function isMeaningfulOverallChange(delta: number, comparabilityScore: number): boolean {
  if (comparabilityScore < 0.55) return false;
  return Math.abs(delta) >= NOISE_THRESHOLD;
}
