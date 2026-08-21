// Stage 3 persistence layer.
//
// Backed by localStorage so the click-through flow genuinely persists across
// leave/return (Bible §81 Day 3 acceptance: "user can leave and return to same
// baseline") without needing Supabase yet. Every function here maps 1:1 to a
// future Supabase table (see lib/types/aura.ts and supabase/migrations/) so
// Stage 5 swaps the implementation, not the call sites.

"use client";

import {
  Comparison,
  FeedbackEntry,
  Goal,
  Mission,
  Profile,
  Scan,
  XpEvent,
} from "@/lib/types/aura";
import { XP_REWARDS, XpReason } from "@/lib/gamification/xp";

const KEYS = {
  userId: "aura.userId",
  profile: "aura.profile",
  scans: "aura.scans",
  missions: "aura.missions",
  comparisons: "aura.comparisons",
  feedback: "aura.feedback",
  analytics: "aura.analyticsEvents",
  xpEvents: "aura.xpEvents",
  awardedBonuses: "aura.awardedBonuses",
} as const;

function isBrowser() {
  return typeof window !== "undefined";
}

function read<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getUserId(): string {
  if (!isBrowser()) return "server";
  let id = window.localStorage.getItem(KEYS.userId);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(KEYS.userId, id);
  }
  return id;
}

// ---- Profile ----

export function getProfile(): Profile | null {
  return read<Profile | null>(KEYS.profile, null);
}

export function saveProfile(update: Partial<Profile>): Profile {
  const existing = getProfile();
  const profile: Profile = {
    userId: getUserId(),
    ageGateConfirmed: false,
    primaryGoal: null,
    createdAt: new Date().toISOString(),
    ...existing,
    ...update,
  };
  write(KEYS.profile, profile);
  return profile;
}

// ---- Scans ----

export function listScans(): Scan[] {
  return read<Scan[]>(KEYS.scans, []).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

export function getScan(id: string): Scan | null {
  return listScans().find((s) => s.id === id) ?? null;
}

export function saveScan(scan: Scan) {
  const scans = read<Scan[]>(KEYS.scans, []);
  const idx = scans.findIndex((s) => s.id === scan.id);
  if (idx >= 0) scans[idx] = scan;
  else scans.push(scan);
  write(KEYS.scans, scans);
}

export function deleteScan(id: string) {
  const scans = read<Scan[]>(KEYS.scans, []).filter((s) => s.id !== id);
  write(KEYS.scans, scans);
  const comparisons = read<Comparison[]>(KEYS.comparisons, []).filter(
    (c) => c.baselineScanId !== id && c.currentScanId !== id
  );
  write(KEYS.comparisons, comparisons);
  const missions = read<Mission[]>(KEYS.missions, []).filter((m) => m.sourceScanId !== id);
  write(KEYS.missions, missions);
}

export function latestCompleteScan(): Scan | null {
  const scans = listScans().filter((s) => s.status === "complete");
  return scans.length ? scans[scans.length - 1] : null;
}

export function baselineScan(): Scan | null {
  const scans = listScans().filter((s) => s.status === "complete" && s.scanType === "baseline");
  return scans.length ? scans[0] : null;
}

// ---- Missions ----

export function listMissions(): Mission[] {
  return read<Mission[]>(KEYS.missions, []);
}

export function activeMissions(): Mission[] {
  return listMissions()
    .filter((m) => m.status === "active")
    .sort((a, b) => new Date(a.startedAt ?? 0).getTime() - new Date(b.startedAt ?? 0).getTime());
}

export function suggestedMissions(): Mission[] {
  return listMissions()
    .filter((m) => m.status === "suggested")
    .sort((a, b) => a.queuePosition - b.queuePosition);
}

export function saveMission(mission: Mission) {
  const missions = read<Mission[]>(KEYS.missions, []);
  const idx = missions.findIndex((m) => m.id === mission.id);
  if (idx >= 0) missions[idx] = mission;
  else missions.push(mission);
  write(KEYS.missions, missions);
}

/**
 * Queues every recommendation from a freshly-scored scan as a "suggested"
 * mission (Current / Up Next / Later on the Journey page), skipping any
 * category the user is already actively working on or has completed.
 */
export function queueMissionsFromScan(scan: Scan): Mission[] {
  if (!scan.modelOutput) return [];
  // Exclude any category that already has a pending or resolved mission —
  // "suggested" too, not just active/completed — otherwise a category still
  // sitting unstarted in the queue gets re-suggested (duplicated) on every
  // later scan that also flags it as an opportunity.
  const existingCategories = new Set(
    listMissions()
      .filter((m) => m.status !== "dismissed")
      .map((m) => m.category)
  );

  const created: Mission[] = scan.modelOutput.recommended_upgrades
    .filter((u) => !existingCategories.has(u.category))
    .map((u, i) => ({
      id: crypto.randomUUID(),
      userId: scan.userId,
      sourceScanId: scan.id,
      category: u.category,
      title: u.title,
      action: u.action,
      reason: u.reason,
      impactBand: u.impact_band,
      effortBand: u.effort_band,
      costBand: u.cost_band,
      timeHorizon: u.time_horizon,
      successCheck: u.success_check,
      missionType: u.mission_type,
      steps: u.steps.map((label) => ({ id: crypto.randomUUID(), label, completed: false, completedAt: null })),
      xpReward: XP_REWARDS.mission_completed,
      status: "suggested" as const,
      queuePosition: i,
      suggestedAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      note: null,
    }));

  const missions = read<Mission[]>(KEYS.missions, []);
  write(KEYS.missions, [...missions, ...created]);
  return created;
}

export function getMission(id: string): Mission | null {
  return listMissions().find((m) => m.id === id) ?? null;
}

// ---- Comparisons ----

export function listComparisons(): Comparison[] {
  return read<Comparison[]>(KEYS.comparisons, []);
}

export function getComparison(id: string): Comparison | null {
  return listComparisons().find((c) => c.id === id) ?? null;
}

export function saveComparison(comparison: Comparison) {
  const comparisons = read<Comparison[]>(KEYS.comparisons, []);
  comparisons.push(comparison);
  write(KEYS.comparisons, comparisons);
}

// ---- Feedback ----

export function saveFeedback(entry: FeedbackEntry) {
  const all = read<FeedbackEntry[]>(KEYS.feedback, []);
  all.push(entry);
  write(KEYS.feedback, all);
}

// ---- XP / gamification ----

export function listXpEvents(): XpEvent[] {
  return read<XpEvent[]>(KEYS.xpEvents, []);
}

export function getXpTotal(): number {
  return listXpEvents().reduce((sum, e) => sum + e.amount, 0);
}

/**
 * Awards XP for a meaningful action. `dedupeKey`, when provided, guards a
 * one-time bonus (e.g. "first confirmed improvement") from being awarded twice —
 * pass a stable key like `bonus:first_confirmed_improvement`.
 */
export function awardXp(reason: XpReason, dedupeKey?: string): number {
  if (dedupeKey) {
    const awarded = read<string[]>(KEYS.awardedBonuses, []);
    if (awarded.includes(dedupeKey)) return getXpTotal();
    write(KEYS.awardedBonuses, [...awarded, dedupeKey]);
  }
  const events = read<XpEvent[]>(KEYS.xpEvents, []);
  events.push({
    id: crypto.randomUUID(),
    userId: getUserId(),
    amount: XP_REWARDS[reason],
    reason,
    createdAt: new Date().toISOString(),
  });
  write(KEYS.xpEvents, events);
  return events.reduce((sum, e) => sum + e.amount, 0);
}

// ---- Danger zone ----

export function deleteAllData() {
  if (!isBrowser()) return;
  Object.values(KEYS).forEach((k) => window.localStorage.removeItem(k));
}

// ---- Draft (in-progress scan wizard state, kept separate from committed scans) ----

export interface ScanDraft {
  scanType: "baseline" | "rescan";
  baselineScanId: string | null;
  goal: Goal | null;
}

const DRAFT_KEY = "aura.draft";

export function getDraft(): ScanDraft {
  return read<ScanDraft>(DRAFT_KEY, { scanType: "baseline", baselineScanId: null, goal: null });
}

export function saveDraft(update: Partial<ScanDraft>) {
  const draft = { ...getDraft(), ...update };
  write(DRAFT_KEY, draft);
  return draft;
}

export function clearDraft() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(DRAFT_KEY);
}
