import { ScanQuality, ScanQualityRating } from "@/lib/types/aura";
import { Badge } from "@/components/ui/Card";

// Scan Quality is about the PHOTOS, never the person — shown separately and
// ahead of the OVR so a user can immediately tell "was this a good scan"
// before seeing a precise-looking number (Bible-adjacent principle: never
// let a low-quality scan present as confidently as a good one).
const RATING_LABEL: Record<ScanQualityRating, string> = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  retake: "Retake Recommended",
};

const RATING_COPY: Record<ScanQualityRating, string> = {
  excellent: "Your photos were ideal for a reliable measurement.",
  good: "Your photos were clear enough for a reliable comparison.",
  fair: "Some measurements may be less reliable — lighting, framing, or visibility was limited.",
  retake: "We don't have enough reliable visual evidence to score this build confidently.",
};

const RATING_TONE: Record<ScanQualityRating, "success" | "warning" | "danger"> = {
  excellent: "success",
  good: "success",
  fair: "warning",
  retake: "danger",
};

export function ScanQualityBadge({ scanQuality }: { scanQuality: ScanQuality }) {
  return (
    <div className="flex w-full items-start gap-3 rounded-2xl border border-border-subtle bg-surface p-4">
      <Badge tone={RATING_TONE[scanQuality.rating]}>Scan Quality: {RATING_LABEL[scanQuality.rating]}</Badge>
      <p className="flex-1 text-sm text-muted">{RATING_COPY[scanQuality.rating]}</p>
    </div>
  );
}
