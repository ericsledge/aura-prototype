"use client";

import Link from "next/link";
import { Badge, Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CATEGORY_LABELS, EffortBand, ImpactBand, Mission, MISSION_TYPE_LABELS, RecommendedUpgrade } from "@/lib/types/aura";
import { XP_REWARDS } from "@/lib/gamification/xp";

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

export function UpgradeCard({
  upgrade,
  onStart,
  started,
}: {
  upgrade: RecommendedUpgrade;
  onStart?: () => void;
  started?: boolean;
}) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs uppercase tracking-wide text-muted">{CATEGORY_LABELS[upgrade.category]}</span>
          <h3 className="mt-1 text-lg font-semibold">{upgrade.title}</h3>
        </div>
        <Badge tone={IMPACT_TONE[upgrade.impact_band]}>{upgrade.impact_band} impact</Badge>
      </div>
      <p className="text-sm text-muted">{upgrade.reason}</p>
      <div className="rounded-2xl bg-surface-elevated p-4 text-sm">
        <span className="font-medium text-foreground">Next action: </span>
        <span className="text-muted">{upgrade.action}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <Badge tone={upgrade.mission_type === "quick_win" ? "accent" : "neutral"}>{MISSION_TYPE_LABELS[upgrade.mission_type]}</Badge>
        <Badge>{EFFORT_LABEL[upgrade.effort_band]}</Badge>
        <Badge>{upgrade.cost_band === "free" ? "Free" : `${upgrade.cost_band} cost`}</Badge>
        <Badge>{upgrade.time_horizon}</Badge>
        <Badge tone="accent">+{XP_REWARDS.mission_completed} XP</Badge>
      </div>
      {onStart && (
        <Button variant={started ? "secondary" : "primary"} onClick={onStart} disabled={started}>
          {started ? "Mission started" : "Start Mission"}
        </Button>
      )}
    </Card>
  );
}

export function MissionSummaryCard({ mission, onComplete }: { mission: Mission; onComplete?: () => void }) {
  const doneSteps = mission.steps.filter((s) => s.completed).length;
  const totalSteps = mission.steps.length;

  return (
    <Link
      href={`/missions/${mission.id}`}
      className="flex flex-col gap-3 rounded-3xl border border-border-subtle bg-surface p-6 transition-colors hover:border-accent/50"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-wide text-muted">{CATEGORY_LABELS[mission.category]}</span>
          <h4 className="font-medium">{mission.title}</h4>
        </div>
        {mission.status === "active" && onComplete ? (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onComplete();
            }}
            className="shrink-0 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent-soft hover:bg-accent/20"
          >
            Mark as done
          </button>
        ) : (
          <Badge tone={mission.status === "completed" ? "success" : "accent"}>
            {mission.status === "completed" ? "Completed" : "Active"}
          </Badge>
        )}
      </div>
      {totalSteps > 0 && mission.status === "active" && (
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-elevated">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent to-accent-soft transition-all"
              style={{ width: `${(doneSteps / totalSteps) * 100}%` }}
            />
          </div>
          <span className="shrink-0 text-xs text-muted">
            {doneSteps}/{totalSteps}
          </span>
        </div>
      )}
    </Link>
  );
}
