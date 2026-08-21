// Pure validation logic — deliberately has NO "server-only" guard (unlike
// analyze.ts) so both the Next.js API route and the standalone stability-test
// script (tools/stability-test.ts, run via tsx outside Next's server context)
// can share the exact same validation instead of two copies drifting apart.

import { AURA_CATEGORIES, AuraCategory, AuraModelOutput, SCORE_TIERS } from "@/lib/types/aura";

/**
 * Structural + semantic validation beyond what the JSON schema already
 * enforces — "never blindly trust model output" (Bible §14). Throws with a
 * specific reason on anything unexpected so a bad response fails loudly
 * instead of silently corrupting a scan.
 */
export function validateModelOutput(value: unknown): AuraModelOutput {
  if (!value || typeof value !== "object") throw new Error("ai_validation_failed: not an object");
  const v = value as Record<string, unknown>;

  const scanQuality = v.scan_quality as AuraModelOutput["scan_quality"] | undefined;
  if (!scanQuality || typeof scanQuality.comparability_score !== "number") {
    throw new Error("ai_validation_failed: missing scan_quality");
  }
  if (scanQuality.comparability_score < 0 || scanQuality.comparability_score > 1) {
    throw new Error("ai_validation_failed: comparability_score out of range");
  }

  const categories = v.categories as AuraModelOutput["categories"] | undefined;
  if (!Array.isArray(categories) || categories.length !== 7) {
    throw new Error("ai_validation_failed: expected exactly 7 categories");
  }
  const seen = new Set<AuraCategory>();
  for (const cat of categories) {
    if (!AURA_CATEGORIES.includes(cat.name)) {
      throw new Error(`ai_validation_failed: unknown category "${cat.name}"`);
    }
    if (seen.has(cat.name)) throw new Error(`ai_validation_failed: duplicate category "${cat.name}"`);
    seen.add(cat.name);
    if (!SCORE_TIERS.includes(cat.tier)) {
      throw new Error(`ai_validation_failed: bad tier for "${cat.name}"`);
    }
    if (typeof cat.tier_adjustment !== "number" || cat.tier_adjustment < -5 || cat.tier_adjustment > 5) {
      throw new Error(`ai_validation_failed: bad tier_adjustment for "${cat.name}"`);
    }
    if (!["low", "medium", "high"].includes(cat.confidence)) {
      throw new Error(`ai_validation_failed: bad confidence for "${cat.name}"`);
    }
  }
  for (const required of AURA_CATEGORIES) {
    if (!seen.has(required)) throw new Error(`ai_validation_failed: missing category "${required}"`);
  }

  const upgrades = v.recommended_upgrades as AuraModelOutput["recommended_upgrades"] | undefined;
  if (!Array.isArray(upgrades) || upgrades.length !== 3) {
    throw new Error("ai_validation_failed: expected exactly 3 recommended_upgrades");
  }
  for (const u of upgrades) {
    if (!AURA_CATEGORIES.includes(u.category)) throw new Error("ai_validation_failed: bad upgrade category");
    if (!["quick_win", "standard", "long_term"].includes(u.mission_type)) {
      throw new Error("ai_validation_failed: bad mission_type");
    }
    if (!Array.isArray(u.steps) || u.steps.length < 1) {
      throw new Error("ai_validation_failed: upgrade missing steps");
    }
  }

  return v as unknown as AuraModelOutput;
}
