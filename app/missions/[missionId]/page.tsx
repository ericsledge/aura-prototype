"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Card } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";
import { EffortBand, ImpactBand, MISSION_TYPE_LABELS, CATEGORY_LABELS } from "@/lib/types/aura";
import { awardXp, baselineScan, getMission, getXpTotal, saveDraft, saveMission, suggestedMissions } from "@/lib/store/auraStore";
import { computeLevel } from "@/lib/gamification/xp";
import { gearForCategory } from "@/lib/mock/gear";
import { track } from "@/lib/analytics/events";
import { useAsyncData } from "@/lib/hooks/useAsyncData";

const IMPACT_TONE: Record<ImpactBand, "success" | "warning" | "neutral"> = {
  high: "success",
  medium: "warning",
  low: "neutral",
};

const EFFORT_LABEL: Record<EffortBand, string> = {
  low: "Low effort",
  medium: "Medium effort",
  high: "High effort",
};

async function loadMissionData(missionId: string) {
  const [mission, baseline, xpTotal, queued] = await Promise.all([
    getMission(missionId),
    baselineScan(),
    getXpTotal(),
    suggestedMissions(),
  ]);
  return { mission, baseline, xpTotal, nextQueued: queued[0] ?? null };
}

export default function MissionDetailPage(props: PageProps<"/missions/[missionId]">) {
  const { missionId } = use(props.params);
  const router = useRouter();
  const { data, loading, refetch } = useAsyncData(() => loadMissionData(missionId), [missionId]);
  const [showGear, setShowGear] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);

  if (loading || !data) return null;
  const { mission, baseline, xpTotal, nextQueued } = data;
  const level = computeLevel(xpTotal);
  const gear = mission ? gearForCategory(mission.category) : [];

  if (!mission) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16 text-center text-muted">
        We couldn&apos;t find that mission.
        <div className="mt-4">
          <LinkButton href="/journey">Back to Journey</LinkButton>
        </div>
      </div>
    );
  }

  async function toggleStep(stepId: string) {
    const updatedSteps = mission!.steps.map((s) => {
      if (s.id !== stepId) return s;
      const completed = !s.completed;
      return { ...s, completed, completedAt: completed ? new Date().toISOString() : null };
    });
    const toggled = updatedSteps.find((s) => s.id === stepId)!;
    await saveMission({ ...mission!, steps: updatedSteps });
    if (toggled.completed) {
      await awardXp("mission_step_completed");
      track("mission_step_completed", { missionId: mission!.id, stepId });
    }
    refetch();
  }

  async function complete() {
    await saveMission({ ...mission!, status: "completed", completedAt: new Date().toISOString() });
    await awardXp("mission_completed");
    track("mission_completed", { missionId: mission!.id, category: mission!.category });
    setJustCompleted(true);
    refetch();
  }

  function compareNow() {
    saveDraft({ scanType: "rescan", baselineScanId: baseline!.id, goal: baseline!.goal });
    track("rescan_started", { baselineScanId: baseline!.id });
    router.push("/scan/capture-tutorial");
  }

  function openGear() {
    setShowGear(true);
    track("shop_recommendations_viewed", { missionId: mission!.id, category: mission!.category });
  }

  const doneSteps = mission.steps.filter((s) => s.completed).length;
  const totalSteps = mission.steps.length;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-5 py-10">
      <LinkButton href="/journey" variant="ghost" size="md" className="!px-0 self-start text-xs">
        ← Back to Journey
      </LinkButton>

      {justCompleted && (
        <Card className="animate-reveal flex flex-col items-center gap-3 border-accent/40 bg-accent/5 text-center">
          <span className="text-xs uppercase tracking-[0.2em] text-accent-soft">Mission Complete</span>
          <h2 className="text-xl font-bold">{mission.title}</h2>
          <p className="text-sm text-success">+{mission.xpReward} XP</p>
          <div className="w-full">
            <div className="mb-1 flex items-center justify-between text-xs text-muted">
              <span>Level {level.level}</span>
              {level.xpForNextLevel !== null && (
                <span>
                  {level.xpIntoLevel} / {level.xpForNextLevel} XP
                </span>
              )}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated">
              <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-soft" style={{ width: `${level.progressRatio * 100}%` }} />
            </div>
          </div>
          <p className="mt-1 text-sm text-muted">Ready to see whether this actually changed your build?</p>
          <div className="flex w-full flex-col gap-2">
            {baseline && <Button onClick={compareNow}>Compare Now</Button>}
            {nextQueued && (
              <LinkButton href={`/missions/${nextQueued.id}`} variant="secondary">
                Choose Next Mission
              </LinkButton>
            )}
          </div>
        </Card>
      )}

      {!justCompleted && (
        <>
          <div>
            <span className="text-xs uppercase tracking-wide text-muted">{CATEGORY_LABELS[mission.category]}</span>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{mission.title}</h1>
              <Badge tone={IMPACT_TONE[mission.impactBand]}>{mission.impactBand} impact</Badge>
            </div>
          </div>

          <Card className="flex flex-col gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Why</p>
              <p className="mt-1 text-sm">{mission.reason}</p>
            </div>
            <div className="rounded-2xl bg-surface-elevated p-4 text-sm">
              <span className="font-medium">Next action: </span>
              <span className="text-muted">{mission.action}</span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Success check</p>
              <p className="mt-1 text-sm">{mission.successCheck}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted">
              <Badge tone={mission.missionType === "quick_win" ? "accent" : "neutral"}>{MISSION_TYPE_LABELS[mission.missionType]}</Badge>
              <Badge>{EFFORT_LABEL[mission.effortBand]}</Badge>
              <Badge>{mission.costBand === "free" ? "Free" : `${mission.costBand} cost`}</Badge>
              <Badge>{mission.timeHorizon}</Badge>
              <Badge tone="accent">+{mission.xpReward} XP</Badge>
            </div>
          </Card>

          {mission.steps.length > 0 && (
            <Card className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Mission Progress · {doneSteps}/{totalSteps}
                </p>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent to-accent-soft transition-all"
                  style={{ width: `${totalSteps ? (doneSteps / totalSteps) * 100 : 0}%` }}
                />
              </div>
              <div className="flex flex-col gap-2">
                {mission.steps.map((step) => (
                  <label
                    key={step.id}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-border-subtle bg-surface-elevated px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={step.completed}
                      disabled={mission.status !== "active"}
                      onChange={() => toggleStep(step.id)}
                      className="h-4 w-4 accent-accent"
                    />
                    <span className={`text-sm ${step.completed ? "text-muted line-through" : ""}`}>{step.label}</span>
                  </label>
                ))}
              </div>
            </Card>
          )}

          {gear.length > 0 && (
            <Card className="flex flex-col gap-3">
              <p className="text-sm font-medium">Need something for this mission?</p>
              {!showGear ? (
                <Button variant="secondary" onClick={openGear}>
                  See Recommended Gear
                </Button>
              ) : (
                <div className="flex flex-col gap-2">
                  {gear.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => track("product_clicked", { missionId: mission!.id, itemId: item.id })}
                      className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface-elevated px-3 py-2 text-left hover:border-accent/50"
                    >
                      <span>
                        <span className="text-sm">{item.name}</span>
                        <span className="block text-xs text-muted">{item.note}</span>
                      </span>
                      <span className="text-xs text-muted">{item.priceBand}</span>
                    </button>
                  ))}
                  <p className="text-xs text-muted">Curated examples for this prototype — not a live store yet.</p>
                </div>
              )}
            </Card>
          )}

          <Card className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Status</p>
              <p className="text-xs text-muted">
                {mission.status === "completed"
                  ? `Completed ${mission.completedAt ? new Date(mission.completedAt).toLocaleDateString() : ""}`
                  : `Started ${mission.startedAt ? new Date(mission.startedAt).toLocaleDateString() : ""}`}
              </p>
            </div>
            {mission.status === "active" ? (
              <Button onClick={complete}>Mark as done</Button>
            ) : (
              <Badge tone="success">Completed</Badge>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
