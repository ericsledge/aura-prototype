// "Road to X" milestone calculation. Presented as a roadmap, never a guarantee —
// only completing real missions and rescanning can actually move the OVR.

export interface MilestoneProgress {
  baseline: number;
  current: number;
  target: number;
  progressRatio: number; // 0-1 between baseline and target
  achieved: boolean;
}

export function nextMilestone(baseline: number, current: number): MilestoneProgress {
  // Round up to the next 5-point mark, always at least +5 ahead of baseline.
  let target = Math.ceil((baseline + 1) / 5) * 5;
  if (target <= baseline) target += 5;
  while (target <= current) target += 5;

  const range = target - baseline;
  const progressRatio = range <= 0 ? 1 : Math.max(0, Math.min(1, (current - baseline) / range));

  return { baseline, current, target, progressRatio, achieved: current >= target };
}
