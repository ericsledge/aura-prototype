// Minimal typed analytics tracker (Bible §5, master spec event list).
// Stage 3: logs to console + localStorage so events are inspectable during
// usability testing. Swap `emit` for a real provider (PostHog etc.) later —
// call sites never change.

"use client";

export type AuraEventName =
  | "landing_viewed"
  | "scan_started"
  | "age_confirmed"
  | "upload_started"
  | "upload_completed"
  | "scan_analysis_started"
  | "scan_analysis_completed"
  | "first_scan_completed"
  | "aura_result_viewed"
  | "upgrade_plan_viewed"
  | "mission_started"
  | "next_mission_started"
  | "mission_step_completed"
  | "mission_completed"
  | "journey_viewed"
  | "rescan_started"
  | "rescan_completed"
  | "comparison_viewed"
  | "second_scan_completed"
  | "third_scan_completed"
  | "level_up"
  | "achievement_unlocked"
  | "shop_recommendations_viewed"
  | "product_clicked"
  | "paywall_viewed"
  | "checkout_started"
  | "subscription_started"
  | "scan_deleted"
  | "account_deleted";

const STORAGE_KEY = "aura.analyticsEvents";

export function track(event: AuraEventName, properties: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const entry = {
    event,
    properties,
    timestamp: new Date().toISOString(),
  };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const events = raw ? JSON.parse(raw) : [];
    events.push(entry);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-500)));
  } catch {
    // best-effort only
  }
  if (process.env.NODE_ENV !== "production") {
    console.debug("[analytics]", event, properties);
  }
}

export function readEvents(): { event: AuraEventName; properties: Record<string, unknown>; timestamp: string }[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
