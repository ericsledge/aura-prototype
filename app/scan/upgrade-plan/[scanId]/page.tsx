"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UpgradeCard } from "@/components/aura/MissionCard";
import { Button, LinkButton } from "@/components/ui/Button";
import { awardXp, getScan, listMissions, saveMission } from "@/lib/store/auraStore";
import { Mission } from "@/lib/types/aura";
import { track } from "@/lib/analytics/events";
import { useAsyncData } from "@/lib/hooks/useAsyncData";

export default function UpgradePlanPage(props: PageProps<"/scan/upgrade-plan/[scanId]">) {
  const { scanId } = use(props.params);
  const router = useRouter();

  const { data: scan, loading: scanLoading } = useAsyncData(() => getScan(scanId), [scanId]);
  const {
    data: missions,
    loading: missionsLoading,
    refetch,
  } = useAsyncData(() => listMissions().then((all) => all.filter((m) => m.sourceScanId === scanId)), [scanId]);

  useEffect(() => {
    if (scan) track("upgrade_plan_viewed", { scanId: scan.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once when data becomes available
  }, [scan?.id]);

  if (scanLoading || missionsLoading) return null;
  if (!scan || !scan.modelOutput) {
    return <div className="mx-auto max-w-lg px-5 py-16 text-center text-muted">We couldn&apos;t find that scan.</div>;
  }

  async function startMission(mission: Mission) {
    const allMissions = await listMissions();
    const alreadyStartedOne = allMissions.some((m) => m.status === "active" || m.status === "completed");
    await saveMission({ ...mission, status: "active", startedAt: new Date().toISOString() });
    await awardXp("mission_started");
    track(alreadyStartedOne ? "next_mission_started" : "mission_started", { scanId: scan!.id, category: mission.category });
    refetch();
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-5 py-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Your Top 3 Upgrades</h1>
        <p className="mt-1 text-sm text-muted">Ranked by impact and effort — start with whichever fits your life right now.</p>
      </div>

      <div className="flex flex-col gap-4">
        {scan.modelOutput.recommended_upgrades.map((upgrade, i) => {
          const mission = (missions ?? []).find((m) => m.category === upgrade.category);
          const started = !mission || mission.status !== "suggested";
          return (
            <UpgradeCard
              key={`${upgrade.category}-${i}`}
              upgrade={upgrade}
              started={started}
              onStart={mission ? () => startMission(mission) : () => {}}
            />
          );
        })}
      </div>

      <div className="flex flex-col gap-3">
        <Button size="lg" onClick={() => router.push("/journey")}>
          Save baseline &amp; continue
        </Button>
        <LinkButton href={`/scan/reveal/${scan.id}`} variant="ghost" size="md">
          ← Back to results
        </LinkButton>
      </div>
    </div>
  );
}
