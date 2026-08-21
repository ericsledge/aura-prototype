"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { OvrDial } from "@/components/aura/OvrDial";
import { CategoryBar } from "@/components/aura/CategoryBar";
import { ScanQualityBadge } from "@/components/aura/ScanQualityBadge";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getScan } from "@/lib/store/auraStore";
import { track } from "@/lib/analytics/events";
import { useAsyncData } from "@/lib/hooks/useAsyncData";
import { CATEGORY_LABELS } from "@/lib/types/aura";

export default function RevealPage(props: PageProps<"/scan/reveal/[scanId]">) {
  const { scanId } = use(props.params);
  const router = useRouter();
  const { data: scan, loading } = useAsyncData(() => getScan(scanId), [scanId]);

  useEffect(() => {
    if (scan) track("aura_result_viewed", { scanId: scan.id, ovr: scan.scoring?.overallScore });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once when data becomes available
  }, [scan?.id]);

  if (loading) return null;
  if (!scan || !scan.scoring || !scan.modelOutput) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16 text-center text-muted">
        We couldn&apos;t find that scan.
        <div className="mt-4">
          <LinkButton href="/">Back to start</LinkButton>
        </div>
      </div>
    );
  }

  const strongest = [...scan.scoring.categories].sort((a, b) => b.score - a.score)[0];
  const weakest = [...scan.scoring.categories].sort((a, b) => a.score - b.score)[0];

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-8 px-5 py-10">
      <ScanQualityBadge scanQuality={scan.modelOutput.scan_quality} />

      <OvrDial score={scan.scoring.overallScore} confidence={scan.scoring.overallConfidence} animateReveal />

      <div className="w-full">
        <h2 className="mb-3 text-sm font-medium text-muted">Category breakdown</h2>
        <Card className="flex flex-col gap-3">
          {scan.scoring.categories.map((c, i) => (
            <div key={c.category} className="animate-fade-up" style={{ animationDelay: `${150 + i * 70}ms` }}>
              <CategoryBar category={c.category} score={c.score} confidence={c.confidence} />
            </div>
          ))}
        </Card>
      </div>

      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
        <Card>
          <p className="text-xs uppercase tracking-wide text-success">Strongest area</p>
          <p className="mt-1 font-medium">{scan.modelOutput.strengths[0] ?? `${CATEGORY_LABELS[strongest.category]} is a current strength.`}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-accent-soft">Biggest opportunity</p>
          <p className="mt-1 font-medium">{scan.modelOutput.opportunities[0] ?? `${CATEGORY_LABELS[weakest.category]} has the most room to grow.`}</p>
        </Card>
      </div>

      <Button size="lg" className="w-full" onClick={() => router.push(`/scan/upgrade-plan/${scan.id}`)}>
        See my Top 3 Upgrades
      </Button>
    </div>
  );
}
