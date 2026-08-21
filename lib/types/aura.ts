// Aura domain types.
// These mirror the Phase 3 AI contract (Master Founder Transfer Bible §78) and the
// prototype data model (§79). Stage 3 uses these types with a mock analysis engine;
// Stage 4 swaps the model call underneath without changing this contract.

export const AURA_CATEGORIES = [
  "hair",
  "facial_hair",
  "skin_grooming",
  "style",
  "accessories",
  "physique_presentation",
  "photo_presence",
] as const;

export type AuraCategory = (typeof AURA_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<AuraCategory, string> = {
  hair: "Hair",
  facial_hair: "Facial Hair / Grooming",
  skin_grooming: "Skin / Grooming Presentation",
  style: "Style",
  accessories: "Accessories",
  physique_presentation: "Physique Presentation",
  photo_presence: "Photo Presence",
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

export interface ScanQuality {
  usable: boolean;
  issues: string[];
  comparability_score: number; // 0-1
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

export interface CategoryModelOutput {
  name: AuraCategory;
  tier: ScoreTier;
  tier_adjustment: number; // -5 to 5, fine positioning within the tier only — never a substitute for picking the right tier
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
  categories: CategoryModelOutput[];
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
