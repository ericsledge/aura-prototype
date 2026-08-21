"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Badge, Card } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";
import { OvrDial } from "@/components/aura/OvrDial";
import { CategoryBar } from "@/components/aura/CategoryBar";
import { MissionSummaryCard } from "@/components/aura/MissionCard";
import {
  activeMissions,
  awardXp,
  baselineScan,
  getXpTotal,
  latestCompleteScan,
  listMissions,
  listScans,
  saveDraft,
  saveMission,
  suggestedMissions,
} from "@/lib/store/auraStore";
import { track } from "@/lib/analytics/events";
import { useHydrated } from "@/lib/hooks/useHydrated";
import { useRefresh } from "@/lib/hooks/useRefresh";
import { daysSince } from "@/lib/utils/time";
import { computeLevel } from "@/lib/gamification/xp";
import { nextMilestone } from "@/lib/gamification/milestones";
import { computeAchievements } from "@/lib/gamification/achievements";
import { CATEGORY_LABELS, Mission } from "@/lib/types/aura";

export default function JourneyPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const [, refresh] = useRefresh();

  useEffect(() => {
    if (hydrated) track("journey_viewed");
  }, [hydrated]);

  if (!hydrated) return null;

  const scans = listScans();
  const completeScans = scans.filter((s) => s.status === "complete" && s.scoring);
  const latest = latestCompleteScan();
  const baseline = baselineScan();
  const allMissions = listMissions();
  const missions = activeMissions();
  const queued = suggestedMissions();
  const completedMissions = allMissions.filter((m) => m.status === "completed");
  const xpTotal = getXpTotal();
  const level = computeLevel(xpTotal);
  const achievements = computeAchievements(scans, allMissions);

  if (!baseline || !latest) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-5 py-20 text-center">
        <h1 className="text-2xl font-bold">No scans yet</h1>
        <p className="text-muted">Start your first Aura scan to build your baseline.</p>
        <LinkButton href="/scan/age-gate">Get My Aura Score</LinkButton>
      </div>
    );
  }

  const daysSinceLatest = daysSince(latest.createdAt);
  const scores = completeScans.map((s) => s.scoring!.overallScore);
  const personalBest = Math.max(...scores);
  const previousScan = completeScans.length > 1 ? completeScans[completeScans.length - 2] : null;
  const deltaSinceLast = previousScan ? latest.scoring!.overallScore - previousScan.scoring!.overallScore : null;
  const milestone = nextMilestone(baseline.scoring!.overallScore, latest.scoring!.overallScore);
  const currentMission = missions[0] ?? null;
  const otherActive = missions.slice(1);
  const lowestCategory = [...latest.scoring!.categories].sort((a, b) => a.score - b.score)[0];

  function startRescan() {
    saveDraft({ scanType: "rescan", baselineScanId: baseline!.id, goal: baseline!.goal });
    track("rescan_started", { baselineScanId: baseline!.id });
    router.push("/scan/capture-tutorial");
  }

  function completeMission(mission: Mission) {
    saveMission({ ...mission, status: "completed", completedAt: new Date().toISOString() });
    awardXp("mission_completed");
    track("mission_completed", { missionId: mission.id, category: mission.category });
    refresh();
  }

  function startQueuedMission(mission: Mission) {
    const alreadyStartedOne = missions.length > 0 || completedMissions.length > 0;
    saveMission({ ...mission, status: "active", startedAt: new Date().toISOString() });
    awardXp("mission_started");
    track(alreadyStartedOne ? "next_mission_started" : "mission_started", { missionId: mission.id, category: mission.category });
    refresh();
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-8 px-5 py-10">
      <div className="flex flex-col items-center gap-2">
        <OvrDial
          score={latest.scoring!.overallScore}
          confidence={latest.scoring!.overallConfidence}
          size={180}
          delta={deltaSinceLast ?? undefined}
        />
        <p className="text-xs text-muted">
          {daysSinceLatest === 0 ? "Scanned today" : `Last scan ${daysSinceLatest} day${daysSinceLatest === 1 ? "" : "s"} ago`}
        </p>
        <div className="mt-2 flex items-center gap-2 text-xs">
          <Badge tone="accent">Level {level.level}</Badge>
          {level.xpForNextLevel !== null && (
            <span className="text-muted">
              {level.xpIntoLevel} / {level.xpForNextLevel} XP
            </span>
          )}
        </div>
        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-surface-elevated">
          <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-soft" style={{ width: `${level.progressRatio * 100}%` }} />
        </div>
      </div>

      <Card>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Road to {milestone.target}</span>
          <span className="text-muted">
            {latest.scoring!.overallScore} → {milestone.target}
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-elevated">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent to-accent-soft transition-all"
            style={{ width: `${milestone.progressRatio * 100}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted">Your current improvement roadmap — not a guaranteed score.</p>
      </Card>

      {currentMission ? (
        <div>
          <h2 className="mb-3 text-sm font-medium text-muted">Current Mission</h2>
          <MissionSummaryCard mission={currentMission} onComplete={() => completeMission(currentMission)} />
          {otherActive.length > 0 && (
            <div className="mt-2 flex flex-col gap-2">
              {otherActive.map((m) => (
                <MissionSummaryCard key={m.id} mission={m} onComplete={() => completeMission(m)} />
              ))}
            </div>
          )}
        </div>
      ) : queued.length > 0 ? (
        <div>
          <h2 className="mb-3 text-sm font-medium text-muted">Choose Your Next Mission</h2>
          <div className="flex flex-col gap-2">
            {queued.map((m) => (
              <Card key={m.id} className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs uppercase tracking-wide text-muted">{CATEGORY_LABELS[m.category]}</span>
                  <h4 className="font-medium">{m.title}</h4>
                </div>
                <Button size="md" onClick={() => startQueuedMission(m)}>
                  Start
                </Button>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <Card className="text-sm text-muted">No missions queued right now.</Card>
      )}

      {queued.length > 0 && currentMission && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-muted">Mission Queue</h2>
          <div className="flex flex-col gap-2">
            {queued.map((m, i) => (
              <Card key={m.id} className="flex items-center justify-between gap-3">
                <div>
                  <Badge>{i === 0 ? "Up Next" : "Later"}</Badge>
                  <h4 className="mt-1 font-medium">{m.title}</h4>
                </div>
                <Button size="md" variant="secondary" onClick={() => startQueuedMission(m)}>
                  Start
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Card className="flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-muted">Ready to see what changed?</p>
        <Button size="lg" onClick={startRescan}>
          Rescan
        </Button>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted">Progression</h2>
        <Card className="grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
          <div>
            <p className="text-lg font-bold tabular-nums">{baseline.scoring!.overallScore}</p>
            <p className="text-xs text-muted">Starting</p>
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums">{latest.scoring!.overallScore}</p>
            <p className="text-xs text-muted">Current</p>
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums">{personalBest}</p>
            <p className="text-xs text-muted">Personal Best</p>
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums">{completedMissions.length}</p>
            <p className="text-xs text-muted">Missions Done</p>
          </div>
        </Card>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted">Build Stats</h2>
          <span className="text-xs text-muted">
            Next to train: {CATEGORY_LABELS[lowestCategory.category]}
          </span>
        </div>
        <Card className="flex flex-col gap-3">
          {latest.scoring!.categories.map((c) => (
            <CategoryBar key={c.category} category={c.category} score={c.score} confidence={c.confidence} />
          ))}
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted">Achievements</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {achievements.map((a) => (
            <div
              key={a.id}
              className={`rounded-2xl border p-3 text-center ${
                a.unlocked ? "border-accent/40 bg-accent/5" : "border-border-subtle bg-surface opacity-50"
              }`}
            >
              <span className="text-lg">{a.unlocked ? "🏅" : "🔒"}</span>
              <p className="mt-1 text-xs font-medium">{a.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted">Scan history</h2>
        <div className="flex flex-col gap-2">
          {[...scans].reverse().map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-2xl border border-border-subtle bg-surface p-4">
              <div>
                <p className="text-sm font-medium">
                  {s.scanType === "baseline" ? "Baseline scan" : "Rescan"} · {s.scoring?.overallScore ?? "—"} OVR
                </p>
                <p className="text-xs text-muted">{new Date(s.createdAt).toLocaleDateString()}</p>
              </div>
              <Badge>{s.status}</Badge>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-center gap-6 text-xs text-muted">
        <LinkButton href="/paywall" variant="ghost" size="md">
          Upgrade to Pro
        </LinkButton>
        <LinkButton href="/privacy" variant="ghost" size="md">
          Privacy &amp; Data
        </LinkButton>
      </div>
    </div>
  );
}
