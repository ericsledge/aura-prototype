// Aura domain types.
// These mirror the Phase 3 AI contract (Master Founder Transfer Bible §78) and the
// prototype data model (§79). Stage 3 uses these types with a mock analysis engine;
// Stage 4 swaps the model call underneath without changing this contract.

// v0.3 category redesign: the previous 7 categories included Photo Presence,
// which mixed in *capture* quality (lighting/framing/angle) with the person's
// actual presentation — that meant a better-lit rescan could move the score
// even with zero real-world change, and it was one of the least stable
// categories under repeated testing. Photo Presence is now Scan Quality
// (below), tracked separately and never part of OVR. Facial Hair/Grooming and
// Skin/Grooming also read as near-duplicate "grooming" scores on the
// dashboard; they're merged into Face. These six are meant to read like
// distinct player-build stats, not a report full of overlapping subscores.
export const AURA_CATEGORIES = ["face", "hair", "style", "physique", "presence", "details"] as const;

export type AuraCategory = (typeof AURA_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<AuraCategory, string> = {
  face: "Face",
  hair: "Hair",
  style: "Style",
  physique: "Physique",
  presence: "Presence",
  details: "Details",
};

export type Confidence = "low" | "medium" | "high";
export type ImpactBand = "low" | "medium" | "high";
export type EffortBand = "low" | "medium" | "high";
export type CostBand = "free" | "low" | "medium" | "high";

export type PhotoViewType = "front" | "three_quarter" | "full_body";

export type Goal =
  | "overall_improvement"
  | "better_grooming"
  | "better_style"
  | "better_photos"
  | "look_put_together"
  | "other";

export const GOAL_LABELS: Record<Goal, string> = {
  overall_improvement: "Overall improvement",
  better_grooming: "Better grooming",
  better_style: "Better style",
  better_photos: "Better photos",
  look_put_together: "Look more put together",
  other: "Other",
};

// ---- Raw "model" output contract (Stage 4 will populate this from OpenAI) ----

// Technical capture quality — lighting, framing, angle, visibility. This is
// about the PHOTO, not the person, and never contributes to OVR: a better-lit
// rescan should never look like real-world progress.
export const SCAN_QUALITY_RATINGS = ["excellent", "good", "fair", "retake"] as const;
export type ScanQualityRating = (typeof SCAN_QUALITY_RATINGS)[number];

export interface ScanQuality {
  usable: boolean;
  issues: string[];
  comparability_score: number; // 0-1
  rating: ScanQualityRating;
}

// A free continuous 0-100 "provisional_score" measurably destabilizes model
// output run-to-run (confirmed via tools/stability-test.ts: identical photos
// swung 11 points OVR / up to 26 points in a single category across 5 runs).
// Forcing a discrete qualitative tier first, with only a small bounded
// adjustment, bounds how far any one run can swing by construction — the
// model has to cross a real qualitative threshold to change the outcome,
// not just land on a different number. lib/scoring/index.ts converts
// tier + tier_adjustment into the final numeric score deterministically.
export const SCORE_TIERS = ["needs_work", "developing", "solid", "strong", "excellent"] as const;
export type ScoreTier = (typeof SCORE_TIERS)[number];

// Rather than one holistic tier per category, the model reports 2-4 named
// submetrics (e.g. Presence -> posture, stance, expression_composure), each
// independently tiered. lib/scoring averages them into the category score.
// This is a second, cheaper layer of the same fix as the tier system itself:
// forcing several smaller, more concrete judgment calls is more stable than
// trusting one broad one, without the cost/latency of multiple API calls.
export interface CategorySubmetric {
  name: string;
  tier: ScoreTier;
  confidence: Confidence;
}

export interface CategoryModelOutput {
  name: Exclude<AuraCategory, "details">; // Details has its own shape below
  submetrics: CategorySubmetric[];
  tier_adjustment: number; // -5 to 5, fine positioning on top of the submetric average — never a substitute for picking the right submetric tiers
  confidence: Confidence;
  evidence: string[];
  controllable_factors: string[];
  unknowns: string[];
}

// Details (accessories/finishing touches) started as one holistic
// "cohesion_tier" judgment rather than submetrics like the other five
// categories — a live stability test confirmed that was the wrong call: it
// was the single worst category (29 pt range across 5 identical runs, vs
// 1-9 pts everywhere else). It now uses the same submetric-averaging
// mechanism as everything else. The boolean visible_details/
// detail_opportunity_present observations are kept alongside — they don't
// drive the score (absence of accessories is never automatically a
// weakness), but they're what the recommendation engine uses to decide
// whether a Details mission actually makes sense.
export interface DetailsModelOutput {
  visible_details: {
    glasses: boolean;
    jewelry: boolean;
    watch: boolean;
    belt_visible: boolean;
    footwear_visible: boolean;
  };
  detail_opportunity_present: boolean;
  submetrics: CategorySubmetric[];
  tier_adjustment: number;
  confidence: Confidence;
  evidence: string[];
  controllable_factors: string[];
  unknowns: string[];
}

export type MissionType = "quick_win" | "standard" | "long_term";

export const MISSION_TYPE_LABELS: Record<MissionType, string> = {
  quick_win: "Quick Win",
  standard: "Standard",
  long_term: "Long-Term",
};

export interface RecommendedUpgrade {
  category: AuraCategory;
  title: string;
  action: string;
  reason: string;
  impact_band: ImpactBand;
  effort_band: EffortBand;
  cost_band: CostBand;
  time_horizon: string;
  success_check: string;
  mission_type: MissionType;
  steps: string[];
}

export interface AuraModelOutput {
  scan_quality: ScanQuality;
  categories: CategoryModelOutput[]; // exactly 5: face, hair, style, physique, presence
  details: DetailsModelOutput; // the 6th stat, shaped differently — see DetailsModelOutput
  strengths: string[];
  opportunities: string[];
  recommended_upgrades: RecommendedUpgrade[];
  safety_flags: string[];
}

// ---- Deterministic scoring service output (Stage 4/5) ----

export interface CategoryScore {
  category: AuraCategory;
  score: number; // 0-100, deterministically computed
  confidence: Confidence;
  evidence: string[];
  controllableFactors: string[];
}

export interface ScoringResult {
  overallScore: number;
  overallConfidence: Confidence;
  categories: CategoryScore[];
  scoringVersion: string;
  rubricVersion: string;
}

// ---- Persisted domain objects (mirrors §79 prototype data model) ----

export type ScanType = "baseline" | "rescan";
export type ScanStatus = "draft" | "processing" | "complete" | "failed";

export interface ScanImageMeta {
  viewType: PhotoViewType;
  fileName: string;
  width: number;
  height: number;
  sizeBytes: number;
  qualityFlags: string[];
  storagePath: string; // Path in the private "scan-photos" Supabase Storage bucket.
}

export interface Scan {
  id: string;
  userId: string;
  scanType: ScanType;
  status: ScanStatus;
  goal: Goal;
  baselineScanId: string | null; // set when scanType === "rescan"
  images: ScanImageMeta[];
  modelOutput: AuraModelOutput | null;
  scoring: ScoringResult | null;
  modelVersion: string;
  rubricVersion: string;
  scoringVersion: string;
  createdAt: string;
  completedAt: string | null;
}

export type MissionStatus = "suggested" | "active" | "completed" | "dismissed";

export interface MissionStep {
  id: string;
  label: string;
  completed: boolean;
  completedAt: string | null;
}

export interface Mission {
  id: string;
  userId: string;
  sourceScanId: string;
  category: AuraCategory;
  title: string;
  action: string;
  reason: string;
  impactBand: ImpactBand;
  effortBand: EffortBand;
  costBand: CostBand;
  timeHorizon: string;
  successCheck: string;
  missionType: MissionType;
  steps: MissionStep[];
  xpReward: number;
  status: MissionStatus;
  queuePosition: number;
  suggestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  note: string | null;
}

export type ChangeCall = "confirmed_improvement" | "likely_improvement" | "stable" | "declined" | "not_comparable";

export interface CategoryDelta {
  category: AuraCategory;
  baselineScore: number;
  currentScore: number;
  delta: number;
  call: ChangeCall;
  attributedMissionTitle: string | null;
}

export interface Comparison {
  id: string;
  baselineScanId: string;
  currentScanId: string;
  comparabilityScore: number;
  overallDelta: number;
  categoryDeltas: CategoryDelta[];
  whatChanged: string[];
  possibleNoise: string[];
  createdAt: string;
}

export interface Profile {
  userId: string;
  ageGateConfirmed: boolean;
  primaryGoal: Goal | null;
  createdAt: string;
}

// ---- Gamification (Phase 3.5): engagement/progression layer, separate from OVR ----
// XP/Level track meaningful actions taken inside the product. They never feed back
// into the Aura score itself — only a real rescan can move the OVR.

export interface XpEvent {
  id: string;
  userId: string;
  amount: number;
  reason: string;
  createdAt: string;
}

export interface Achievement {
  id: string;
  label: string;
  description: string;
  unlocked: boolean;
  unlockedAt: string | null;
}

// ---- Wizard-transient shape (upload -> processing handoff, not persisted long-term) ----

export interface PendingImage {
  viewType: PhotoViewType;
  dataUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
  qualityFlags: string[];
  usable: boolean;
  hash?: string;
}

export interface FeedbackEntry {
  id: string;
  userId: string;
  scanId: string;
  helpful: boolean | null;
  scoreFeltStable: boolean | null;
  recommendationUsed: boolean | null;
  notes: string;
  createdAt: string;
}
