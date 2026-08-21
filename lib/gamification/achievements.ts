// Achievements are derived purely from scans/missions history — never stored
// separately — so they can never drift out of sync with the actual record.

import { Achievement, Mission, Scan } from "@/lib/types/aura";

export function computeAchievements(scans: Scan[], missions: Mission[]): Achievement[] {
  const completeScans = scans
    .filter((s) => s.status === "complete" && s.scoring)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const baseline = completeScans.find((s) => s.scanType === "baseline") ?? null;
  const rescans = completeScans.filter((s) => s.scanType === "rescan");
  const startedMissions = missions.filter((m) => m.status === "active" || m.status === "completed" || m.startedAt);
  const completedMissions = missions.filter((m) => m.status === "completed");

  const scores = completeScans.map((s) => s.scoring!.overallScore);
  const personalBest = scores.length ? Math.max(...scores) : null;
  const latestScore = scores.length ? scores[scores.length - 1] : null;

  const firstLevelUp = rescans.some((s, i) => {
    const prior = i === 0 ? baseline : rescans[i - 1];
    return prior && s.scoring!.overallScore > prior.scoring!.overallScore;
  });

  const plus5 = baseline && latestScore !== null ? latestScore - baseline.scoring!.overallScore >= 5 : false;

  const def = (id: string, label: string, description: string, unlocked: boolean, unlockedAt: string | null): Achievement => ({
    id,
    label,
    description,
    unlocked,
    unlockedAt,
  });

  return [
    def("first_scan", "First Scan", "Complete your first Aura scan.", !!baseline, baseline?.createdAt ?? null),
    def(
      "first_mission",
      "First Mission",
      "Start your first upgrade mission.",
      startedMissions.length > 0,
      startedMissions[0]?.startedAt ?? null
    ),
    def(
      "first_level_up",
      "First Level Up",
      "Improve your OVR after a rescan.",
      firstLevelUp,
      rescans.find((s, i) => {
        const prior = i === 0 ? baseline : rescans[i - 1];
        return prior && s.scoring!.overallScore > prior.scoring!.overallScore;
      })?.createdAt ?? null
    ),
    def("plus5_club", "+5 Club", "Gain five OVR points from your baseline.", plus5, plus5 ? completeScans[completeScans.length - 1]?.createdAt ?? null : null),
    def(
      "personal_best",
      "Personal Best",
      "Reach a new highest Aura score.",
      personalBest !== null && rescans.length > 0 && personalBest === latestScore,
      personalBest !== null ? completeScans[completeScans.length - 1]?.createdAt ?? null : null
    ),
    def(
      "three_missions",
      "Consistent Build",
      "Complete three real missions.",
      completedMissions.length >= 3,
      completedMissions[2]?.completedAt ?? null
    ),
  ];
}
