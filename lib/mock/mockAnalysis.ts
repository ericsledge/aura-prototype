// Stage 3 mock analysis engine.
//
// This stands in for the real OpenAI vision pipeline (Stage 4). It is intentionally
// NOT random-per-call: it is seeded deterministically from the actual uploaded files
// and goal, so re-running the "same" scan produces the same result — demonstrating
// the score-stability principle (Bible §77) even before real AI is wired in.
//
// Swap point for Stage 4: replace `runMockAnalysis` with a call to
// `lib/ai/analyze.ts` that hits OpenAI and returns the same `AuraModelOutput` shape.
// Nothing downstream (scoring, comparison, UI) needs to change.

import { AURA_CATEGORIES, AuraCategory, AuraModelOutput, Confidence, Goal, MissionType, RecommendedUpgrade } from "@/lib/types/aura";
import { ScoringResult } from "@/lib/types/aura";

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

const EVIDENCE_BANK: Record<AuraCategory, string[]> = {
  hair: [
    "Hair shows a defined shape with visible recent maintenance.",
    "Hairline and edges appear grown out past the last visible shaping.",
    "Style appears coordinated with the overall presentation.",
    "Texture is visible but styling appears inconsistent across the photos.",
  ],
  facial_hair: [
    "Facial hair edges appear neatly maintained.",
    "Growth appears past its last visible trim/shape date.",
    "Grooming looks intentional and coordinated with hairstyle.",
    "Coverage is uneven in visible areas.",
  ],
  skin_grooming: [
    "Visible grooming/finish appears consistent across photos.",
    "Some visible texture is present at this photo resolution.",
    "Presentation looks well-maintained under the available lighting.",
  ],
  style: [
    "Garment fit appears loose relative to frame in the full-body photo.",
    "Color coordination between layers appears intentional.",
    "Silhouette reads as put-together for the stated goal.",
    "Layering appears mismatched with the rest of the outfit.",
  ],
  accessories: [
    "No visible accessories in the provided photos.",
    "Visible accessory appears coordinated with the outfit.",
    "Accessory choice appears to compete with the overall silhouette.",
  ],
  physique_presentation: [
    "Posture appears upright and confident in the full-body photo.",
    "Shoulders appear slightly rounded in the presentation shot.",
    "Clothing fit follows the frame cleanly in the visible photo.",
  ],
  photo_presence: [
    "Framing and distance are consistent with a standard presentation photo.",
    "Lighting is even across the visible face and body.",
    "Camera angle is slightly below eye level, which affects framing.",
    "Expression reads as natural and unposed.",
  ],
};

const STRENGTH_TEMPLATES: Record<AuraCategory, string> = {
  hair: "Hair presentation is a current strength.",
  facial_hair: "Facial hair grooming is a current strength.",
  skin_grooming: "Grooming presentation is a current strength.",
  style: "Style coordination is a current strength.",
  accessories: "Accessory choices are working well.",
  physique_presentation: "Posture and presentation read confidently.",
  photo_presence: "Photo framing and lighting are working in your favor.",
};

const OPPORTUNITY_TEMPLATES: Record<AuraCategory, string> = {
  hair: "Hair is the highest-leverage opportunity right now.",
  facial_hair: "Facial hair grooming has room to improve.",
  skin_grooming: "Grooming presentation has room to improve.",
  style: "Style/fit is the highest-leverage opportunity right now.",
  accessories: "Accessories are an easy, low-cost opportunity.",
  physique_presentation: "Posture and photo stance have room to improve.",
  photo_presence: "Photo setup (lighting/framing) is limiting your score.",
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
  facial_hair: [
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
  skin_grooming: [
    {
      title: "Tighten up your grooming routine",
      action: "Add a basic daily grooming routine (cleanse + moisturize) for 30 days before rescanning.",
      reason: "Visible grooming/finish has room to improve at this photo quality.",
      costBand: "low",
      effortBand: "medium",
      timeHorizon: "30 days",
      successCheck: "Skin/grooming presentation looks more consistent in the rescan.",
      missionType: "long_term",
      steps: ["Choose a cleanser + moisturizer", "Complete 3 days", "Complete 7 days", "Complete 30 days", "Retake comparison photos"],
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
  accessories: [
    {
      title: "Add one coordinated accessory",
      action: "Add a single accessory (watch, glasses, or simple jewelry) that matches your outfit's tone.",
      reason: "No accessories are currently supporting the overall presentation.",
      costBand: "low",
      effortBand: "low",
      timeHorizon: "This week",
      successCheck: "Accessory reads as coordinated, not competing, in the rescan.",
      missionType: "quick_win",
      steps: ["Pick one accessory that matches your outfit tone", "Wear it", "Retake your full-body photo"],
    },
  ],
  physique_presentation: [
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
  photo_presence: [
    {
      title: "Fix your photo lighting and angle",
      action: "Retake your presentation photo in even, front-facing natural light, with the camera at eye level.",
      reason: "Current lighting/angle is limiting how clearly your presentation reads.",
      costBand: "free",
      effortBand: "low",
      timeHorizon: "Next photo",
      successCheck: "Lighting and framing are more consistent in the rescan.",
      missionType: "quick_win",
      steps: ["Find even, front-facing natural light", "Set the camera at eye level", "Retake all 3 photos"],
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

export function runMockAnalysis(input: MockAnalysisInput): AuraModelOutput {
  const rng = mulberry32(seedFromString(input.seedKey));

  const categories = AURA_CATEGORIES.map((cat) => {
    let provisionalScore: number;

    if (input.baseline) {
      const baselineScore = input.baseline.scoring.categories.find((c) => c.category === cat)?.score ?? 65;
      const isActiveMission = input.baseline.activeMissionCategories.includes(cat);
      const delta = isActiveMission ? 4 + rng() * 10 : (rng() - 0.5) * 6;
      provisionalScore = Math.round(Math.min(98, Math.max(20, baselineScore + delta)));
    } else {
      provisionalScore = Math.round(48 + rng() * 40);
    }

    const confidence = confidenceFromRng(rng, input.comparabilityScore);
    const bank = EVIDENCE_BANK[cat];
    const evidenceCount = confidence === "low" ? 1 : 2;
    const evidence: string[] = [];
    for (let i = 0; i < evidenceCount; i++) {
      evidence.push(bank[Math.floor(rng() * bank.length)]);
    }

    return {
      name: cat,
      provisional_score: provisionalScore,
      confidence,
      evidence: Array.from(new Set(evidence)),
      controllable_factors: [CATEGORY_CONTROLLABLE[cat]],
      unknowns: CATEGORY_UNKNOWNS[cat],
    };
  });

  const sorted = [...categories].sort((a, b) => b.provisional_score - a.provisional_score);
  const strengths = sorted.slice(0, 2).map((c) => STRENGTH_TEMPLATES[c.name]);
  const opportunities = sorted
    .slice(-3)
    .reverse()
    .map((c) => OPPORTUNITY_TEMPLATES[c.name]);

  const lowestThree = [...categories].sort((a, b) => a.provisional_score - b.provisional_score).slice(0, 3);
  const unsortedUpgrades: RecommendedUpgrade[] = lowestThree.map((c) => {
    const bank = UPGRADE_BANK[c.name];
    const template = bank[Math.floor(rng() * bank.length)];
    const impact_band: RecommendedUpgrade["impact_band"] = c.provisional_score < 60 ? "high" : c.provisional_score < 75 ? "medium" : "low";
    return {
      category: c.name,
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

  return {
    scan_quality: {
      usable,
      issues,
      comparability_score: input.comparabilityScore,
    },
    categories,
    strengths,
    opportunities,
    recommended_upgrades,
    safety_flags: [],
  };
}

const CATEGORY_CONTROLLABLE: Record<AuraCategory, string> = {
  hair: "Haircut, styling, maintenance schedule",
  facial_hair: "Trim, shape, shave, maintenance",
  skin_grooming: "Grooming routine, visible finish",
  style: "Fit, layering, color coordination",
  accessories: "Choice and coordination of visible accessories",
  physique_presentation: "Posture, clothing fit, photo stance",
  photo_presence: "Lighting, framing, camera angle, expression",
};

const CATEGORY_UNKNOWNS: Record<AuraCategory, string[]> = {
  hair: ["Hair type/texture constraints not stated by user"],
  facial_hair: ["Personal preference for facial hair not stated"],
  skin_grooming: ["Any underlying skin condition — not assessed"],
  style: ["Budget and wardrobe access not stated"],
  accessories: ["Personal style preference not fully known"],
  physique_presentation: ["Physical constraints not stated"],
  photo_presence: ["Camera equipment available not stated"],
};
