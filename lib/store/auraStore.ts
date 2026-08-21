// Stage 5 persistence layer — Supabase-backed (real accounts, real database,
// private photo storage). Replaces the Stage 3 localStorage version; exported
// function names are mostly unchanged, but every one is now async and scoped
// to the signed-in (anonymous or not) Supabase user via RLS.

"use client";

import { createClient } from "@/lib/supabase/client";
import { ensureSession } from "@/lib/supabase/session";
import { deleteScanPhotos, uploadScanPhoto } from "@/lib/supabase/storage";
import { XP_REWARDS, XpReason } from "@/lib/gamification/xp";
import {
  AuraCategory,
  AuraModelOutput,
  Comparison,
  Confidence,
  FeedbackEntry,
  Goal,
  Mission,
  MissionStatus,
  PendingImage,
  Profile,
  Scan,
  ScanImageMeta,
  ScanType,
  ScoringResult,
} from "@/lib/types/aura";

// ---- DB row shapes (snake_case, as returned by Supabase) ----

interface ScanImageRow {
  view_type: string;
  storage_path: string;
  width: number;
  height: number;
  size_bytes: number;
  quality_flags: string[];
}

interface ScanCategoryRow {
  category: AuraCategory;
  score: number;
  confidence: Confidence;
  evidence: string[];
  controllable_factors: string[];
}

interface ScanRow {
  id: string;
  user_id: string;
  scan_type: ScanType;
  status: Scan["status"];
  goal: Goal;
  baseline_scan_id: string | null;
  overall_score: number | null;
  overall_confidence: Confidence | null;
  model_output: AuraModelOutput | null;
  model_version: string;
  rubric_version: string;
  scoring_version: string;
  created_at: string;
  completed_at: string | null;
  scan_images?: ScanImageRow[];
  scan_categories?: ScanCategoryRow[];
}

export async function getUserId(): Promise<string> {
  return ensureSession();
}

// ---- Profile ----

export async function getProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const userId = await ensureSession();
  const { data, error } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    userId: data.user_id,
    ageGateConfirmed: data.age_gate_confirmed,
    primaryGoal: data.primary_goal,
    createdAt: data.created_at,
  };
}

export async function saveProfile(update: Partial<Omit<Profile, "userId">>): Promise<Profile> {
  const supabase = createClient();
  const userId = await ensureSession();
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        user_id: userId,
        ...(update.ageGateConfirmed !== undefined ? { age_gate_confirmed: update.ageGateConfirmed } : {}),
        ...(update.primaryGoal !== undefined ? { primary_goal: update.primaryGoal } : {}),
      },
      { onConflict: "user_id" }
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  return {
    userId: data.user_id,
    ageGateConfirmed: data.age_gate_confirmed,
    primaryGoal: data.primary_goal,
    createdAt: data.created_at,
  };
}

// ---- Scans ----

const SCAN_SELECT = "*, scan_images(*), scan_categories(*)";

function mapScanRow(row: ScanRow): Scan {
  const images: ScanImageMeta[] = (row.scan_images ?? [])
    .slice()
    .sort((a, b) => a.view_type.localeCompare(b.view_type))
    .map((img) => ({
      viewType: img.view_type as ScanImageMeta["viewType"],
      fileName: `${img.view_type}.jpg`,
      width: img.width,
      height: img.height,
      sizeBytes: img.size_bytes,
      qualityFlags: img.quality_flags ?? [],
      storagePath: img.storage_path,
    }));

  const scoring: ScoringResult | null =
    row.overall_score != null
      ? {
          overallScore: row.overall_score,
          overallConfidence: row.overall_confidence!,
          categories: (row.scan_categories ?? []).map((c) => ({
            category: c.category,
            score: c.score,
            confidence: c.confidence,
            evidence: c.evidence ?? [],
            controllableFactors: c.controllable_factors ?? [],
          })),
          scoringVersion: row.scoring_version,
          rubricVersion: row.rubric_version,
        }
      : null;

  return {
    id: row.id,
    userId: row.user_id,
    scanType: row.scan_type,
    status: row.status,
    goal: row.goal,
    baselineScanId: row.baseline_scan_id,
    images,
    modelOutput: row.model_output,
    scoring,
    modelVersion: row.model_version,
    rubricVersion: row.rubric_version,
    scoringVersion: row.scoring_version,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export async function listScans(): Promise<Scan[]> {
  const supabase = createClient();
  await ensureSession();
  const { data, error } = await supabase.from("scans").select(SCAN_SELECT).order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapScanRow);
}

export async function getScan(id: string): Promise<Scan | null> {
  const supabase = createClient();
  await ensureSession();
  const { data, error } = await supabase.from("scans").select(SCAN_SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapScanRow(data) : null;
}

export async function latestCompleteScan(): Promise<Scan | null> {
  const scans = (await listScans()).filter((s) => s.status === "complete");
  return scans.length ? scans[scans.length - 1] : null;
}

export async function baselineScan(): Promise<Scan | null> {
  const scans = (await listScans()).filter((s) => s.status === "complete" && s.scanType === "baseline");
  return scans.length ? scans[0] : null;
}

export interface CreateScanInput {
  scanType: ScanType;
  goal: Goal;
  baselineScanId: string | null;
  images: PendingImage[];
  modelOutput: AuraModelOutput;
  scoring: ScoringResult;
  modelVersion: string;
}

/** Uploads photos to private storage, then persists the scan + its category rows. */
export async function createScan(input: CreateScanInput): Promise<Scan> {
  const supabase = createClient();
  const userId = await ensureSession();

  const { data: scanRow, error: scanError } = await supabase
    .from("scans")
    .insert({
      user_id: userId,
      scan_type: input.scanType,
      status: "complete",
      goal: input.goal,
      baseline_scan_id: input.baselineScanId,
      overall_score: input.scoring.overallScore,
      overall_confidence: input.scoring.overallConfidence,
      model_output: input.modelOutput,
      model_version: input.modelVersion,
      rubric_version: input.scoring.rubricVersion,
      scoring_version: input.scoring.scoringVersion,
      completed_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (scanError) throw new Error(scanError.message);
  const scanId = scanRow.id as string;

  const uploadedPaths = await Promise.all(
    input.images.map((img) => uploadScanPhoto(userId, scanId, img.viewType, img.dataUrl))
  );

  const { error: imagesError } = await supabase.from("scan_images").insert(
    input.images.map((img, i) => ({
      scan_id: scanId,
      view_type: img.viewType,
      storage_path: uploadedPaths[i],
      width: img.width,
      height: img.height,
      size_bytes: img.sizeBytes,
      quality_flags: img.qualityFlags,
    }))
  );
  if (imagesError) throw new Error(imagesError.message);

  const { error: categoriesError } = await supabase.from("scan_categories").insert(
    input.scoring.categories.map((c) => ({
      scan_id: scanId,
      category: c.category,
      score: c.score,
      confidence: c.confidence,
      evidence: c.evidence,
      controllable_factors: c.controllableFactors,
    }))
  );
  if (categoriesError) throw new Error(categoriesError.message);

  const created = await getScan(scanId);
  if (!created) throw new Error("scan_reload_failed");
  return created;
}

export async function deleteScan(id: string): Promise<void> {
  const supabase = createClient();
  await ensureSession();
  const scan = await getScan(id);
  if (scan) {
    await deleteScanPhotos(scan.images.map((img) => img.storagePath)).catch(() => {});
  }
  const { error } = await supabase.from("scans").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---- Missions ----

interface MissionRow {
  id: string;
  user_id: string;
  source_scan_id: string;
  category: AuraCategory;
  title: string;
  action: string;
  reason: string;
  impact_band: Mission["impactBand"];
  effort_band: Mission["effortBand"];
  cost_band: Mission["costBand"];
  time_horizon: string;
  success_check: string;
  mission_type: Mission["missionType"];
  steps: Mission["steps"];
  xp_reward: number;
  status: MissionStatus;
  queue_position: number;
  suggested_at: string;
  started_at: string | null;
  completed_at: string | null;
  note: string | null;
}

function mapMissionRow(row: MissionRow): Mission {
  return {
    id: row.id,
    userId: row.user_id,
    sourceScanId: row.source_scan_id,
    category: row.category,
    title: row.title,
    action: row.action,
    reason: row.reason,
    impactBand: row.impact_band,
    effortBand: row.effort_band,
    costBand: row.cost_band,
    timeHorizon: row.time_horizon,
    successCheck: row.success_check,
    missionType: row.mission_type,
    steps: row.steps ?? [],
    xpReward: row.xp_reward,
    status: row.status,
    queuePosition: row.queue_position,
    suggestedAt: row.suggested_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    note: row.note,
  };
}

export async function listMissions(): Promise<Mission[]> {
  const supabase = createClient();
  await ensureSession();
  const { data, error } = await supabase.from("missions").select("*");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapMissionRow);
}

export async function activeMissions(): Promise<Mission[]> {
  return (await listMissions())
    .filter((m) => m.status === "active")
    .sort((a, b) => new Date(a.startedAt ?? 0).getTime() - new Date(b.startedAt ?? 0).getTime());
}

export async function suggestedMissions(): Promise<Mission[]> {
  return (await listMissions()).filter((m) => m.status === "suggested").sort((a, b) => a.queuePosition - b.queuePosition);
}

export async function getMission(id: string): Promise<Mission | null> {
  const supabase = createClient();
  await ensureSession();
  const { data, error } = await supabase.from("missions").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapMissionRow(data) : null;
}

export async function saveMission(mission: Mission): Promise<void> {
  const supabase = createClient();
  const userId = await ensureSession();
  const { error } = await supabase.from("missions").update({
    status: mission.status,
    steps: mission.steps,
    started_at: mission.startedAt,
    completed_at: mission.completedAt,
    note: mission.note,
  }).eq("id", mission.id).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/**
 * Queues every recommendation from a freshly-scored scan as a "suggested"
 * mission, skipping any category the user already has a pending, active, or
 * completed mission for.
 */
export async function queueMissionsFromScan(scan: Scan): Promise<void> {
  if (!scan.modelOutput) return;
  const supabase = createClient();
  const userId = await ensureSession();

  const existing = await listMissions();
  const existingCategories = new Set(existing.filter((m) => m.status !== "dismissed").map((m) => m.category));

  const toInsert = scan.modelOutput.recommended_upgrades
    .filter((u) => !existingCategories.has(u.category))
    .map((u, i) => ({
      user_id: userId,
      source_scan_id: scan.id,
      category: u.category,
      title: u.title,
      action: u.action,
      reason: u.reason,
      impact_band: u.impact_band,
      effort_band: u.effort_band,
      cost_band: u.cost_band,
      time_horizon: u.time_horizon,
      success_check: u.success_check,
      mission_type: u.mission_type,
      steps: u.steps.map((label) => ({ id: crypto.randomUUID(), label, completed: false, completedAt: null })),
      xp_reward: XP_REWARDS.mission_completed,
      status: "suggested" as MissionStatus,
      queue_position: i,
    }));

  if (toInsert.length === 0) return;
  const { error } = await supabase.from("missions").insert(toInsert);
  if (error) throw new Error(error.message);
}

// ---- Comparisons ----

interface ComparisonRow {
  id: string;
  baseline_scan_id: string;
  current_scan_id: string;
  comparability_score: number;
  overall_delta: number;
  category_deltas: Comparison["categoryDeltas"];
  what_changed: string[];
  possible_noise: string[];
  created_at: string;
}

function mapComparisonRow(row: ComparisonRow): Comparison {
  return {
    id: row.id,
    baselineScanId: row.baseline_scan_id,
    currentScanId: row.current_scan_id,
    comparabilityScore: row.comparability_score,
    overallDelta: row.overall_delta,
    categoryDeltas: row.category_deltas ?? [],
    whatChanged: row.what_changed ?? [],
    possibleNoise: row.possible_noise ?? [],
    createdAt: row.created_at,
  };
}

export async function getComparison(id: string): Promise<Comparison | null> {
  const supabase = createClient();
  await ensureSession();
  const { data, error } = await supabase.from("scan_comparisons").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapComparisonRow(data) : null;
}

export async function saveComparison(comparison: Comparison): Promise<Comparison> {
  const supabase = createClient();
  const userId = await ensureSession();
  const { data, error } = await supabase
    .from("scan_comparisons")
    .insert({
      user_id: userId,
      baseline_scan_id: comparison.baselineScanId,
      current_scan_id: comparison.currentScanId,
      comparability_score: comparison.comparabilityScore,
      overall_delta: comparison.overallDelta,
      category_deltas: comparison.categoryDeltas,
      what_changed: comparison.whatChanged,
      possible_noise: comparison.possibleNoise,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapComparisonRow(data);
}

// ---- Feedback ----

export async function saveFeedback(entry: Omit<FeedbackEntry, "id" | "userId" | "createdAt">): Promise<void> {
  const supabase = createClient();
  const userId = await ensureSession();
  const { error } = await supabase.from("feedback").insert({
    user_id: userId,
    scan_id: entry.scanId,
    helpful: entry.helpful,
    score_felt_stable: entry.scoreFeltStable,
    recommendation_used: entry.recommendationUsed,
    notes: entry.notes,
  });
  if (error) throw new Error(error.message);
}

// ---- XP ----

export async function getXpTotal(): Promise<number> {
  const supabase = createClient();
  await ensureSession();
  const { data, error } = await supabase.from("xp_events").select("amount");
  if (error) throw new Error(error.message);
  return (data ?? []).reduce((sum, e) => sum + e.amount, 0);
}

export async function awardXp(reason: XpReason, dedupeKey?: string): Promise<void> {
  const supabase = createClient();
  const userId = await ensureSession();
  const { error } = await supabase.from("xp_events").insert({
    user_id: userId,
    amount: XP_REWARDS[reason],
    reason,
    dedupe_key: dedupeKey ?? null,
  });
  // A dedupe_key collision (unique constraint) means this one-time bonus was
  // already awarded — that's success, not a failure, so swallow it.
  if (error && !error.message.includes("duplicate key")) throw new Error(error.message);
}

// ---- Danger zone ----

export async function deleteAllData(): Promise<void> {
  const supabase = createClient();
  const userId = await ensureSession();
  // Deleting the user cascades every table via `on delete cascade`. Storage
  // objects aren't covered by that cascade, so remove them first.
  const scans = await listScans();
  const allPaths = scans.flatMap((s) => s.images.map((i) => i.storagePath));
  await deleteScanPhotos(allPaths).catch(() => {});
  const { error } = await supabase.rpc("delete_own_account");
  if (error) {
    // Fallback if the RPC isn't set up: delete rows table-by-table instead
    // of the auth user itself (anonymous user row is harmless to leave behind).
    await Promise.all([
      supabase.from("scans").delete().eq("user_id", userId),
      supabase.from("missions").delete().eq("user_id", userId),
      supabase.from("scan_comparisons").delete().eq("user_id", userId),
      supabase.from("feedback").delete().eq("user_id", userId),
      supabase.from("xp_events").delete().eq("user_id", userId),
      supabase.from("profiles").delete().eq("user_id", userId),
    ]);
  }
  await supabase.auth.signOut();
}

// ---- Draft (in-progress scan wizard state) ----
// Pure ephemeral UI state for the multi-step capture wizard — never needs to
// survive across devices, so this alone stays in localStorage.

export interface ScanDraft {
  scanType: "baseline" | "rescan";
  baselineScanId: string | null;
  goal: Goal | null;
}

const DRAFT_KEY = "aura.draft";

export function getDraft(): ScanDraft {
  if (typeof window === "undefined") return { scanType: "baseline", baselineScanId: null, goal: null };
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : { scanType: "baseline", baselineScanId: null, goal: null };
  } catch {
    return { scanType: "baseline", baselineScanId: null, goal: null };
  }
}

export function saveDraft(update: Partial<ScanDraft>) {
  const draft = { ...getDraft(), ...update };
  if (typeof window !== "undefined") window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  return draft;
}

export function clearDraft() {
  if (typeof window !== "undefined") window.localStorage.removeItem(DRAFT_KEY);
}
