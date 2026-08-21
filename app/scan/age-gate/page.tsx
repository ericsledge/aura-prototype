"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WizardShell } from "@/components/aura/WizardShell";
import { Button } from "@/components/ui/Button";
import { track } from "@/lib/analytics/events";
import { saveProfile } from "@/lib/store/auraStore";

export default function AgeGatePage() {
  const router = useRouter();
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);

  useEffect(() => {
    track("scan_started");
  }, []);

  const canContinue = ageConfirmed && rightsConfirmed;

  async function handleContinue() {
    await saveProfile({ ageGateConfirmed: true });
    track("age_confirmed");
    router.push("/scan/goal");
  }

  return (
    <WizardShell step={1} title="Before we start" subtitle="Aura is built for adults only." backHref="/">
      <div className="flex flex-col gap-4">
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border-subtle bg-surface p-4">
          <input
            type="checkbox"
            checked={ageConfirmed}
            onChange={(e) => setAgeConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-accent"
          />
          <span className="text-sm">I confirm that I am 18 years of age or older.</span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border-subtle bg-surface p-4">
          <input
            type="checkbox"
            checked={rightsConfirmed}
            onChange={(e) => setRightsConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-accent"
          />
          <span className="text-sm">
            I confirm the photos I upload are of myself, and I have the right to upload and analyze them.
          </span>
        </label>

        <div className="mt-2 rounded-2xl bg-surface-elevated p-4 text-xs text-muted">
          Your photos are stored privately and are never shared publicly. You can delete any scan, your photos,
          or your entire account at any time from Privacy &amp; Data Controls.
        </div>

        <Button size="lg" disabled={!canContinue} onClick={handleContinue} className="mt-2">
          Continue
        </Button>
      </div>
    </WizardShell>
  );
}
