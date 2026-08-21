// XP / Level system — engagement layer, deliberately separate from Aura OVR.
//
// Rule (non-negotiable, per founder direction): mission completion and other
// in-app actions award XP only. They never change a scan's score. Only a real
// rescan through the scoring pipeline can move the OVR. This keeps the score
// meaningful — a user can't grind their way to a higher Aura by clicking things.

export const XP_REWARDS = {
  mission_started: 25,
  mission_step_completed: 15,
  mission_completed: 100,
  valid_comparison_scan: 150,
  first_confirmed_improvement: 200,
  plus5_from_baseline: 300,
} as const;

export type XpReason = keyof typeof XP_REWARDS;

// Cumulative XP required to REACH each level. Level = index + 1.
const LEVEL_THRESHOLDS = [0, 150, 400, 750, 1200, 1800, 2600, 3600, 4800, 6200, 8000];

export interface LevelProgress {
  level: number;
  xp: number;
  xpIntoLevel: number;
  xpForNextLevel: number | null; // null once at max defined level
  progressRatio: number; // 0-1, for a progress bar
}

export function computeLevel(xp: number): LevelProgress {
  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
      break;
    }
  }

  const currentThreshold = LEVEL_THRESHOLDS[level - 1];
  const nextThreshold = LEVEL_THRESHOLDS[level];

  if (nextThreshold === undefined) {
    return { level, xp, xpIntoLevel: xp - currentThreshold, xpForNextLevel: null, progressRatio: 1 };
  }

  const xpIntoLevel = xp - currentThreshold;
  const xpForNextLevel = nextThreshold - currentThreshold;
  return {
    level,
    xp,
    xpIntoLevel,
    xpForNextLevel,
    progressRatio: xpIntoLevel / xpForNextLevel,
  };
}
