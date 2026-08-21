"use client";

import { useRouter } from "next/navigation";
import { WizardShell } from "@/components/aura/WizardShell";
import { Button } from "@/components/ui/Button";
import { getDraft } from "@/lib/store/auraStore";
import { useHydrated } from "@/lib/hooks/useHydrated";
import { CaptureSilhouette } from "@/components/aura/CaptureSilhouette";

const SLOTS = [
  { title: "Front", body: "Face forward, neutral expression, even lighting, no filters.", kind: "front" as const },
  { title: "3/4 or side", body: "Same environment, upper body visible.", kind: "three_quarter" as const },
  { title: "Full-body / presentation", body: "Full outfit visible, standing naturally, no extreme pose.", kind: "full_body" as const },
];

export default function CaptureTutorialPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const isRescan = hydrated && getDraft().scanType === "rescan";

  return (
    <WizardShell
      step={3}
      title={isRescan ? "Reproduce your baseline" : "Let's get 3 standardized photos"}
      subtitle={
        isRescan
          ? "Match the lighting, distance, and pose from your first scan as closely as you can — that's what makes the comparison trustworthy."
          : "Consistency is what makes your future progress comparisons trustworthy."
      }
      backHref="/scan/goal"
    >
      <div className="flex flex-col gap-4">
        {SLOTS.map((slot) => (
          <div key={slot.title} className="flex items-center gap-4 rounded-2xl border border-border-subtle bg-surface p-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-border-subtle">
              <CaptureSilhouette kind={slot.kind} />
            </div>
            <div>
              <h3 className="font-medium">{slot.title}</h3>
              <p className="text-sm text-muted">{slot.body}</p>
            </div>
          </div>
        ))}
        <div className="rounded-2xl bg-surface-elevated p-4 text-xs text-muted">
          Avoid heavy filters, extreme crops, or obscured faces — Aura will ask for a retake rather than guess.
        </div>
        <Button size="lg" onClick={() => router.push("/scan/upload")} className="mt-2">
          I&apos;m ready
        </Button>
      </div>
    </WizardShell>
  );
}
