// Deterministic scoring service.
//
// Per the Bible (§13, §76): the model only outputs structured evidence — never
// a final number. This module owns the actual arithmetic that turns that into
// a final OVR, so scoring behavior is reproducible and auditable independent
// of model sampling noise.

import {
  AURA_CATEGORIES,
  AuraCategory,
  AuraModelOutput,
  CategoryScore,
  Confidence,
  ScoreTier,
  ScoringResult,
} from "@/lib/types/aura";

export const RUBRIC_VERSION = "aura-rubric-v0.3";
// v0.2: category score derives from a discrete tier + bounded adjustment
// instead of a free 0-100 model estimate (fixed an 11 pt OVR stability-test
// range). v0.3: category redesign — Hair/Style stayed stable as a single
// holistic tier, but Physique/Presence/Details did not, so those (and now
// all five non-Details categories, for consistency) are scored from 2-4
// named submetrics averaged together rather than one holistic judgment —
// a second, cheaper layer of the same fix (more, smaller judgment calls
// beat one big one). Also replaced the 7-category set (which had Photo
// Presence mixing capture quality into the person's score, and Facial
// Hair/Skin Grooming reading as duplicate "grooming" stats) with 6 distinct
// stats: Face, Hair, Style, Physique, Presence, Details. Photo Presence
// became Scan Quality, tracked separately and never part of OVR.
export const SCORING_VERSION = "aura-scoring-v0.3";
// Weights are versioned independently of the rubric so they can be
// recalibrated later without implying the underlying category definitions
// changed too.
export const CATEGORY_WEIGHT_VERSION = "aura-weights-v0.1";

// Base value for each tier: the deterministic system owns these constants,
// never the model. tier_adjustment (-5..+5) only nudges within a tier, so a
// tier flip — which now requires the model to cross a real qualitative
// threshold rather than just land on a different number — is the only way
// score movement between runs.
export const TIER_BASE: Record<ScoreTier, number> = {
  needs_work: 40,
  developing: 55,
  solid: 70,
  strong: 82,
  excellent: 92,
};

// Starting weights (§13/§76: "start with equal-ish weights, then test whether
// user goals should alter emphasis"). Not claimed to be perfectly calibrated —
// versioned above so this can be revisited from real Phase 3 data.
const CATEGORY_WEIGHTS: Record<AuraCategory, number> = {
  face: 0.2,
  hair: 0.15,
  style: 0.2,
  physique: 0.15,
  presence: 0.15,
  details: 0.15,
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
 * confidence read "low" on nearly every scan (with several independent
 * per-category rolls, the odds that *at least one* lands low are high even
 * when the input is perfectly comparable) — technically defensible but
 * functionally indistinguishable from "always low," which trains users to
 * ignore the confidence label entirely. A few individually-uncertain
 * categories no longer sink the whole scan; genuinely widespread
 * uncertainty still does.
 */
function combineConfidence(categories: Confidence[], comparabilityScore: number): Confidence {
  if (comparabilityScore < 0.55) return "low";

  const lowCount = categories.filter((c) => c === "low").length;
  const highCount = categories.filter((c) => c === "high").length;

  if (lowCount >= 3) return "low";
  if (lowCount <= 1 && highCount >= categories.length - 1) return "high";
  return "medium";
}

/**
 * Computes final category scores and OVR from raw model evidence.
 * Deterministic: identical input always yields identical output.
 */
export function computeScoring(model: AuraModelOutput): ScoringResult {
  const penaltyMultiplier = (confidence: Confidence) => {
    const comparabilityPenalty = 0.85 + 0.15 * model.scan_quality.comparability_score;
    return CONFIDENCE_PENALTY[confidence] * comparabilityPenalty;
  };

  // Shared by all six categories: average the named submetric tiers, then
  // apply the category's own small bounded adjustment on top. Details used
  // to be the one exception (a single holistic "cohesion_tier" judgment) —
  // that measurably made it the least stable category (29 pt range across 5
  // identical runs vs 1-9 everywhere else), so it now goes through the same
  // averaging as everything else.
  function scoreFromSubmetrics(
    cat: AuraCategory,
    raw: { submetrics: { tier: ScoreTier }[]; tier_adjustment: number; confidence: Confidence; evidence: string[]; controllable_factors: string[] } | undefined
  ): CategoryScore {
    if (!raw) {
      return { category: cat, score: 60, confidence: "low" as Confidence, evidence: [], controllableFactors: [] };
    }
    const submetricAverage =
      raw.submetrics.reduce((sum, s) => sum + TIER_BASE[s.tier], 0) / Math.max(1, raw.submetrics.length);
    const tierScore = submetricAverage + clamp(raw.tier_adjustment, -5, 5);
    const score = clamp(Math.round(tierScore * penaltyMultiplier(raw.confidence)), 0, 100);
    return {
      category: cat,
      score,
      confidence: raw.confidence,
      evidence: raw.evidence,
      controllableFactors: raw.controllable_factors,
    };
  }

  const categories: CategoryScore[] = AURA_CATEGORIES.map((cat) =>
    cat === "details" ? scoreFromSubmetrics(cat, model.details) : scoreFromSubmetrics(cat, model.categories.find((c) => c.name === cat))
  );

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
