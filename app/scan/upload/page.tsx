"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WizardShell } from "@/components/aura/WizardShell";
import { PhotoSlot, SlotState } from "@/components/aura/PhotoSlot";
import { Button } from "@/components/ui/Button";
import { Badge, Card } from "@/components/ui/Card";
import { analyzeImageFile } from "@/lib/quality";
import { hashFile, resizeToDataUrl } from "@/lib/image/resize";
import { PendingImage, PhotoViewType } from "@/lib/types/aura";
import { track } from "@/lib/analytics/events";
import { getDraft } from "@/lib/store/auraStore";
import { useHydrated } from "@/lib/hooks/useHydrated";

const SLOTS: { key: PhotoViewType; label: string; hint: string; capture: "user" | "environment" }[] = [
  { key: "front", label: "Front", hint: "Face forward, neutral lighting", capture: "user" },
  { key: "three_quarter", label: "3/4 or side", hint: "Same environment, upper body visible", capture: "user" },
  { key: "full_body", label: "Full-body", hint: "Full outfit visible, natural stance", capture: "environment" },
];

type Phase = "upload" | "quality";

export default function UploadPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const isRescan = hydrated && getDraft().scanType === "rescan";
  const [slots, setSlots] = useState<Record<PhotoViewType, SlotState>>({
    front: { status: "empty", issues: [], usable: false },
    three_quarter: { status: "empty", issues: [], usable: false },
    full_body: { status: "empty", issues: [], usable: false },
  });
  const [pending, setPending] = useState<Record<PhotoViewType, PendingImage | null>>({
    front: null,
    three_quarter: null,
    full_body: null,
  });
  const [phase, setPhase] = useState<Phase>("upload");

  useEffect(() => {
    track("upload_started");
  }, []);

  async function handleFile(viewType: PhotoViewType, file: File) {
    setSlots((s) => ({ ...s, [viewType]: { status: "analyzing", issues: [], usable: false } }));

    const [quality, resized, hash] = await Promise.all([
      analyzeImageFile(file),
      resizeToDataUrl(file),
      hashFile(file),
    ]);

    const issues = [...quality.issues];
    const otherImages = Object.entries(pending)
      .filter(([k]) => k !== viewType)
      .map(([, v]) => v);
    const dup = otherImages.find((p) => p && p.hash === hash);
    if (dup) issues.push("duplicate_photo");

    const usable = issues.length === 0;

    setSlots((s) => ({
      ...s,
      [viewType]: { status: "ready", dataUrl: resized.dataUrl, issues, usable },
    }));
    setPending((p) => ({
      ...p,
      [viewType]: {
        viewType,
        dataUrl: resized.dataUrl,
        width: resized.width,
        height: resized.height,
        sizeBytes: file.size,
        qualityFlags: issues,
        usable,
        hash,
      },
    }));
  }

  function handleRemove(viewType: PhotoViewType) {
    setSlots((s) => ({ ...s, [viewType]: { status: "empty", issues: [], usable: false } }));
    setPending((p) => ({ ...p, [viewType]: null }));
  }

  const allUploaded = SLOTS.every((s) => slots[s.key].status === "ready");
  const allUsable = SLOTS.every((s) => slots[s.key].usable);

  function goToQuality() {
    track("upload_completed");
    setPhase("quality");
  }

  function proceedToAnalysis() {
    const images = SLOTS.map((s) => pending[s.key]!);
    sessionStorage.setItem("aura.pendingScanImages", JSON.stringify(images));
    router.push("/scan/processing");
  }

  if (phase === "quality") {
    return (
      <WizardShell
        step={4}
        title="Quality check"
        subtitle="We check comparability before scoring anything."
        onBack={() => setPhase("upload")}
      >
        <div className="flex flex-col gap-3">
          {SLOTS.map((s) => {
            const slot = slots[s.key];
            return (
              <Card key={s.key} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{s.label}</p>
                  {slot.issues.length > 0 ? (
                    <p className="text-xs text-warning">{slot.issues.length} issue(s) detected</p>
                  ) : (
                    <p className="text-xs text-success">Looks comparable</p>
                  )}
                </div>
                <Badge tone={slot.usable ? "success" : "warning"}>{slot.usable ? "Comparable" : "Retake"}</Badge>
              </Card>
            );
          })}

          {!allUsable && (
            <div className="rounded-2xl bg-warning/10 p-4 text-sm text-warning">
              Some photos need a retake for a reliable result. You can continue anyway, but confidence will be
              lower and we may ask again next time.
            </div>
          )}

          <div className="mt-4 flex flex-col gap-3">
            <Button size="lg" onClick={proceedToAnalysis}>
              {allUsable ? "Analyze my photos" : "Continue anyway"}
            </Button>
            <Button size="lg" variant="secondary" onClick={() => setPhase("upload")}>
              Edit photos
            </Button>
          </div>
        </div>
      </WizardShell>
    );
  }

  return (
    <WizardShell
      step={4}
      title={isRescan ? "Upload your rescan photos" : "Upload your 3 photos"}
      subtitle="JPG, PNG, or WEBP. We check each photo automatically."
      backHref="/scan/capture-tutorial"
    >
      <div className="flex flex-col gap-4">
        {SLOTS.map((s) => (
          <PhotoSlot
            key={s.key}
            label={s.label}
            hint={s.hint}
            state={slots[s.key]}
            onFile={(file) => handleFile(s.key, file)}
            onRemove={() => handleRemove(s.key)}
            capture={s.capture}
          />
        ))}
        <Button size="lg" disabled={!allUploaded} onClick={goToQuality} className="mt-2">
          Continue
        </Button>
      </div>
    </WizardShell>
  );
}
