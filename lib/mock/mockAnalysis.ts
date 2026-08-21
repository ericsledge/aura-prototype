// Local-dev-only mock analysis engine (real AI is lib/ai/analyze.ts — see
// app/scan/processing/page.tsx for how the two are chosen between).
//
// It is intentionally NOT random-per-call: it is seeded deterministically from
// the actual uploaded files and goal, so re-running the "same" scan produces
// the same result — demonstrating the score-stability principle (Bible §77)
// even though it's not the real model.

import {
  AURA_CATEGORIES,
  AuraCategory,
  AuraModelOutput,
  CategorySubmetric,
  Confidence,
  Goal,
  MissionType,
  RecommendedUpgrade,
  ScoreTier,
} from "@/lib/types/aura";
import { ScoringResult } from "@/lib/types/aura";
import { TIER_BASE } from "@/lib/scoring";

type NonDetailsCategory = Exclude<AuraCategory, "details">;
const NON_DETAILS_CATEGORIES = AURA_CATEGORIES.filter((c): c is NonDetailsCategory => c !== "details");

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

// Strips the internal-only sorting field before returning model output —
// isolated here so the warning suppression lives in exactly one place.
function omitInternalScore<T extends { _internalScore: number }>(obj: T): Omit<T, "_internalScore"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _internalScore, ...rest } = obj;
  return rest;
}

function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFromString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return hash >>> 0;
}

// Converts a continuous 0-100 estimate into the nearest tier + bounded
// adjustment — the same shape the real AI contract uses (lib/types/aura.ts).
function scoreToTier(score: number): { tier: ScoreTier; tier_adjustment: number } {
  let closest: ScoreTier = "needs_work";
  let closestDist = Infinity;
  for (const tier of Object.keys(TIER_BASE) as ScoreTier[]) {
    const dist = Math.abs(score - TIER_BASE[tier]);
    if (dist < closestDist) {
      closest = tier;
      closestDist = dist;
    }
  }
  return { tier: closest, tier_adjustment: clamp(Math.round(score - TIER_BASE[closest]), -5, 5) };
}

const SUBMETRIC_NAMES: Record<NonDetailsCategory, string[]> = {
  face: ["skin_presentation", "facial_grooming", "brows_edges", "overall_finish"],
  hair: ["shape_maintenance", "styling_intentionality", "framing"],
  style: ["fit", "coordination", "color_harmony", "silhouette"],
  physique: ["presentation_fit", "silhouette", "posture_frame"],
  presence: ["posture", "stance", "expression_composure"],
};

const DETAILS_SUBMETRIC_NAMES = ["accessory_cohesion", "footwear_finish", "visible_finishing_elements", "outfit_detail_cohesion"];

const EVIDENCE_BANK: Record<AuraCategory, string[]> = {
  face: [
    "Facial grooming appears neatly maintained with clean edges.",
    "Skin presentation appears consistent under the available lighting.",
    "Brow area appears untrimmed relative to the rest of the grooming.",
    "Overall facial finish reads as intentional and put-together.",
  ],
  hair: [
    "Hair shows a defined shape with visible recent maintenance.",
    "Hairline and edges appear grown out past the last visible shaping.",
    "Style appears coordinated with the overall presentation.",
    "Texture is visible but styling appears inconsistent across the photos.",
  ],
  style: [
    "Garment fit appears loose relative to frame in the full-body photo.",
    "Color coordination between layers appears intentional.",
    "Silhouette reads as put-together for the stated goal.",
    "Layering appears mismatched with the rest of the outfit.",
  ],
  physique: [
    "Posture appears upright and confident in the full-body photo.",
    "Clothing fit follows the frame cleanly in the visible photo.",
    "Silhouette reads as slightly loose relative to the frame.",
  ],
  presence: [
    "Shoulders appear open and posture reads upright in the full-body photo.",
    "Stance appears balanced and grounded.",
    "Expression reads as composed and natural.",
    "Posture appears slightly rounded in the presentation shot.",
  ],
  details: [
    "No visible accessories in the provided photos.",
    "Visible accessory appears coordinated with the outfit.",
    "Accessory choice appears to compete with the overall silhouette.",
    "Footwear is not clearly visible in the provided photos.",
  ],
};

const STRENGTH_TEMPLATES: Record<AuraCategory, string> = {
  face: "Facial grooming is a current strength.",
  hair: "Hair presentation is a current strength.",
  style: "Style coordination is a current strength.",
  physique: "Posture and presentation read confidently.",
  presence: "Presence carries confidently under these conditions.",
  details: "Details read as cohesive and intentional.",
};

const OPPORTUNITY_TEMPLATES: Record<AuraCategory, string> = {
  face: "Facial grooming has room to improve.",
  hair: "Hair is the highest-leverage opportunity right now.",
  style: "Style/fit is the highest-leverage opportunity right now.",
  physique: "Posture and clothing fit have room to improve.",
  presence: "Presence under the capture conditions has room to improve.",
  details: "A finishing detail is an easy, low-cost opportunity.",
};

interface UpgradeTemplate {
  title: string;
  action: string;
  reason: string;
  costBand: RecommendedUpgrade["cost_band"];
  effortBand: RecommendedUpgrade["effort_band"];
  timeHorizon: string;
  successCheck: string;
  missionType: MissionType;
  steps: string[];
}

const UPGRADE_BANK: Record<AuraCategory, UpgradeTemplate[]> = {
  face: [
    {
      title: "Clean up facial hair edges",
      action: "Have facial hair trimmed/shaped with clean, symmetric edges, or shave fully if that fits your goal.",
      reason: "Current edges appear inconsistent in the provided photos.",
      costBand: "low",
      effortBand: "low",
      timeHorizon: "This week",
      successCheck: "Edges read as intentional and symmetric in the rescan.",
      missionType: "quick_win",
      steps: ["Trim or shave", "Clean up the edges", "Retake your front photo"],
    },
  ],
  hair: [
    {
      title: "Get a fresh, shaped haircut",
      action: "Book a haircut that re-establishes a clean shape and defined edges, then re-photograph under the same conditions.",
      reason: "Hair shape appears grown past its last defined cut.",
      costBand: "low",
      effortBand: "low",
      timeHorizon: "This week",
      successCheck: "Edges and shape are visibly cleaner in the rescan front photo.",
      missionType: "quick_win",
      steps: ["Book a haircut appointment", "Get the cut", "Retake your front photo in similar lighting"],
    },
  ],
  style: [
    {
      title: "Fix garment fit in your top layer",
      action: "Try a more structured, better-fitted top layer with a cleaner shoulder line, and compare in the same full-body shot.",
      reason: "Current silhouette reads as less structured than it could.",
      costBand: "medium",
      effortBand: "medium",
      timeHorizon: "2 weeks",
      successCheck: "Silhouette appears more structured in the rescan full-body photo.",
      missionType: "standard",
      steps: ["Pick a more structured top layer", "Wear it for your next presentation photo", "Retake your full-body photo"],
    },
    {
      title: "Coordinate your layer colors",
      action: "Pick one dominant color and one accent color instead of three competing tones.",
      reason: "Color coordination between layers currently reads as mismatched.",
      costBand: "free",
      effortBand: "low",
      timeHorizon: "Next outfit",
      successCheck: "Layers read as intentionally coordinated in the rescan.",
      missionType: "quick_win",
      steps: ["Choose one dominant + one accent color", "Wear the coordinated outfit", "Retake your full-body photo"],
    },
  ],
  physique: [
    {
      title: "Fix garment fit for your frame",
      action: "Try a layer that follows your frame more closely instead of hanging loose, and compare in the same full-body shot.",
      reason: "Current fit reads as loose relative to the frame in the full-body photo.",
      costBand: "medium",
      effortBand: "medium",
      timeHorizon: "2 weeks",
      successCheck: "Silhouette reads as more fitted in the rescan.",
      missionType: "standard",
      steps: ["Pick a layer that follows your frame", "Wear it for your next presentation photo", "Retake your full-body photo"],
    },
  ],
  presence: [
    {
      title: "Practice standing posture for photos",
      action: "Practice a neutral, upright stance (shoulders back, weight even) before your next presentation photo.",
      reason: "Shoulders appear slightly rounded in the current full-body photo.",
      costBand: "free",
      effortBand: "low",
      timeHorizon: "Next photo",
      successCheck: "Posture reads as more upright in the rescan.",
      missionType: "quick_win",
      steps: ["Practice a neutral upright stance", "Retake your full-body photo with that stance"],
    },
  ],
  details: [
    {
      title: "Add one coordinated finishing detail",
      action: "Add a single detail (watch, glasses, or simple jewelry) that matches your outfit's tone, only if it fits your style.",
      reason: "A finishing detail could tie the presentation together.",
      costBand: "low",
      effortBand: "low",
      timeHorizon: "This week",
      successCheck: "The detail reads as coordinated, not competing, in the rescan.",
      missionType: "quick_win",
      steps: ["Pick one detail that matches your outfit tone", "Wear it", "Retake your full-body photo"],
    },
  ],
};

export interface MockAnalysisInput {
  seedKey: string; // derived from uploaded file identity + goal
  goal: Goal;
  comparabilityScore: number; // 0-1, from quality analysis
  imageIssues: string[]; // flattened, non-blocking issues across all 3 photos
  baseline?: {
    scoring: ScoringResult;
    activeMissionCategories: AuraCategory[];
  };
}

function confidenceFromRng(rng: () => number, comparabilityScore: number): Confidence {
  const roll = rng() * comparabilityScore;
  if (roll > 0.62) return "high";
  if (roll > 0.32) return "medium";
  return "low";
}

function continuousScoreFor(cat: AuraCategory, rng: () => number, baseline?: MockAnalysisInput["baseline"]): number {
  if (baseline) {
    const baselineScore = baseline.scoring.categories.find((c) => c.category === cat)?.score ?? 65;
    const isActiveMission = baseline.activeMissionCategories.includes(cat);
    const delta = isActiveMission ? 4 + rng() * 10 : (rng() - 0.5) * 6;
    return Math.round(Math.min(98, Math.max(20, baselineScore + delta)));
  }
  return Math.round(48 + rng() * 40);
}

export function runMockAnalysis(input: MockAnalysisInput): AuraModelOutput {
  const rng = mulberry32(seedFromString(input.seedKey));

  const categories = NON_DETAILS_CATEGORIES.map((cat) => {
    const centerScore = continuousScoreFor(cat, rng, input.baseline);

    const submetrics: CategorySubmetric[] = SUBMETRIC_NAMES[cat].map((name) => {
      const jittered = clamp(centerScore + (rng() - 0.5) * 12, 15, 99);
      return { name, tier: scoreToTier(jittered).tier, confidence: confidenceFromRng(rng, input.comparabilityScore) };
    });
    const submetricAvg = submetrics.reduce((sum, s) => sum + TIER_BASE[s.tier], 0) / submetrics.length;
    const tier_adjustment = clamp(Math.round(centerScore - submetricAvg), -5, 5);

    const confidence = confidenceFromRng(rng, input.comparabilityScore);
    const bank = EVIDENCE_BANK[cat];
    const evidenceCount = confidence === "low" ? 1 : 2;
    const evidence: string[] = [];
    for (let i = 0; i < evidenceCount; i++) evidence.push(bank[Math.floor(rng() * bank.length)]);

    return {
      name: cat,
      _internalScore: centerScore,
      submetrics,
      tier_adjustment,
      confidence,
      evidence: Array.from(new Set(evidence)),
      controllable_factors: [CATEGORY_CONTROLLABLE[cat]],
      unknowns: CATEGORY_UNKNOWNS[cat],
    };
  });

  // ---- Details (separate shape — booleans, never penalized for absence) ----
  const detailsCenterScore = continuousScoreFor("details", rng, input.baseline);
  const visible_details = {
    glasses: rng() > 0.6,
    jewelry: rng() > 0.6,
    watch: rng() > 0.5,
    belt_visible: rng() > 0.5,
    footwear_visible: rng() > 0.4,
  };
  const anyDetailVisible = Object.values(visible_details).some(Boolean);
  const detail_opportunity_present = !anyDetailVisible ? rng() > 0.5 : rng() > 0.7;
  const detailsSubmetrics: CategorySubmetric[] = DETAILS_SUBMETRIC_NAMES.map((name) => {
    const jittered = clamp(detailsCenterScore + (rng() - 0.5) * 12, 15, 99);
    return { name, tier: scoreToTier(jittered).tier, confidence: confidenceFromRng(rng, input.comparabilityScore) };
  });
  const detailsSubmetricAvg = detailsSubmetrics.reduce((sum, s) => sum + TIER_BASE[s.tier], 0) / detailsSubmetrics.length;
  const detailsAdjustment = clamp(Math.round(detailsCenterScore - detailsSubmetricAvg), -5, 5);
  const detailsConfidence = confidenceFromRng(rng, input.comparabilityScore);
  const detailsEvidenceBank = EVIDENCE_BANK.details;
  const details = {
    visible_details,
    detail_opportunity_present,
    submetrics: detailsSubmetrics,
    tier_adjustment: detailsAdjustment,
    confidence: detailsConfidence,
    evidence: [detailsEvidenceBank[Math.floor(rng() * detailsEvidenceBank.length)]],
    controllable_factors: [CATEGORY_CONTROLLABLE.details],
    unknowns: CATEGORY_UNKNOWNS.details,
    _internalScore: detailsCenterScore,
  };

  const allForSorting: { name: AuraCategory; _internalScore: number }[] = [
    ...categories.map((c) => ({ name: c.name as AuraCategory, _internalScore: c._internalScore })),
    { name: "details" as const, _internalScore: details._internalScore },
  ];
  const sorted = [...allForSorting].sort((a, b) => b._internalScore - a._internalScore);
  const strengths = sorted.slice(0, 2).map((c) => STRENGTH_TEMPLATES[c.name]);
  const opportunities = sorted
    .slice(-3)
    .reverse()
    .map((c) => OPPORTUNITY_TEMPLATES[c.name]);

  const lowestThree = [...allForSorting].sort((a, b) => a._internalScore - b._internalScore).slice(0, 3);
  const unsortedUpgrades: RecommendedUpgrade[] = lowestThree.map((c) => {
    const catName = c.name;
    const bank = UPGRADE_BANK[catName];
    const template = bank[Math.floor(rng() * bank.length)];
    const impact_band: RecommendedUpgrade["impact_band"] = c._internalScore < 60 ? "high" : c._internalScore < 75 ? "medium" : "low";
    return {
      category: catName,
      title: template.title,
      action: template.action,
      reason: template.reason,
      impact_band,
      effort_band: template.effortBand,
      cost_band: template.costBand,
      time_horizon: template.timeHorizon,
      success_check: template.successCheck,
      mission_type: template.missionType,
      steps: template.steps,
    };
  });

  // Surface a fast win first when one exists — a tester's first mission
  // completing within hours (not 30 days) is what makes the loop testable.
  const typeOrder: Record<MissionType, number> = { quick_win: 0, standard: 1, long_term: 2 };
  const recommended_upgrades = [...unsortedUpgrades].sort((a, b) => typeOrder[a.mission_type] - typeOrder[b.mission_type]);

  const issues = [...input.imageIssues];
  const usable = input.comparabilityScore >= 0.4;
  const rating = input.comparabilityScore >= 0.85 ? "excellent" : input.comparabilityScore >= 0.65 ? "good" : input.comparabilityScore >= 0.4 ? "fair" : "retake";

  return {
    scan_quality: {
      usable,
      issues,
      comparability_score: input.comparabilityScore,
      rating,
    },
    categories: categories.map(omitInternalScore),
    details: omitInternalScore(details),
    strengths,
    opportunities,
    recommended_upgrades,
    safety_flags: [],
  };
}

const CATEGORY_CONTROLLABLE: Record<AuraCategory, string> = {
  face: "Facial grooming, edge cleanup, skin finish routine",
  hair: "Haircut, styling, maintenance schedule",
  style: "Fit, layering, color coordination",
  physique: "Clothing fit, posture, photo stance",
  presence: "Posture, stance, expression under the capture conditions",
  details: "Choice and coordination of visible finishing details",
};

const CATEGORY_UNKNOWNS: Record<AuraCategory, string[]> = {
  face: ["Any underlying skin condition — not assessed"],
  hair: ["Hair type/texture constraints not stated by user"],
  style: ["Budget and wardrobe access not stated"],
  physique: ["Physical constraints not stated"],
  presence: ["Camera equipment/environment constraints not stated"],
  details: ["Personal style preference not fully known"],
};
