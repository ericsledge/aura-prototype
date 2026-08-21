"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LinkButton } from "@/components/ui/Button";
import { OvrDial } from "@/components/aura/OvrDial";
import { track } from "@/lib/analytics/events";
import { baselineScan } from "@/lib/store/auraStore";
import { useAsyncData } from "@/lib/hooks/useAsyncData";

export default function Landing() {
  const router = useRouter();
  const { data: baseline, loading } = useAsyncData(baselineScan, []);
  const returning = !loading && !!baseline;

  useEffect(() => {
    if (loading) return;
    if (returning) {
      router.replace("/journey");
    } else {
      track("landing_viewed");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per load/returning-status change
  }, [loading, returning]);

  // Returning users never see the marketing page — they already know what
  // Aura is. Render nothing while the redirect to their dashboard happens.
  if (loading || returning) return null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center gap-14 px-5 pb-24 pt-16 text-center">
      <div className="flex flex-col items-center gap-5">
        <span className="rounded-full border border-border-subtle bg-surface px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-muted">
          Adults 18+ · Private by default
        </span>
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          Level Up Your Real-Life Build
        </h1>
        <p className="max-w-xl text-lg text-muted">
          Scan your current presentation. Get your highest-impact upgrades. Rescan to see what actually changed.
        </p>
        <LinkButton href="/scan/age-gate" size="lg" className="mt-2">
          Get My Aura Score
        </LinkButton>
        <p className="max-w-sm text-xs text-muted">
          Aura measures your controllable presentation — grooming, style, and photo setup — not your worth,
          health, or identity. You can delete your photos and data anytime.
        </p>
      </div>

      <div className="flex flex-col items-center gap-4">
        <OvrDial score={68} confidence="medium" size={200} />
        <p className="max-w-sm text-sm text-muted">
          Example reveal — your real score comes from your own standardized photos.
        </p>
      </div>

      <div className="grid w-full gap-4 sm:grid-cols-3">
        {[
          { title: "Scan", body: "Three standardized photos: front, 3/4, and full-body." },
          { title: "Improve", body: "Your top 3 controllable upgrades — ranked by impact and effort." },
          { title: "Rescan", body: "Make the change, then measure what actually moved." },
        ].map((step) => (
          <div key={step.title} className="rounded-2xl border border-border-subtle bg-surface p-5 text-left">
            <h3 className="font-semibold">{step.title}</h3>
            <p className="mt-1 text-sm text-muted">{step.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
