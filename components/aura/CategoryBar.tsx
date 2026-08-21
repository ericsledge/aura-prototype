import { AuraCategory, CATEGORY_LABELS, Confidence } from "@/lib/types/aura";

export function CategoryBar({
  category,
  score,
  confidence,
  delta,
}: {
  category: AuraCategory;
  score: number;
  confidence?: Confidence;
  delta?: number;
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="w-40 shrink-0 text-sm text-muted">{CATEGORY_LABELS[category]}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-elevated">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent to-accent-soft"
          style={{ width: `${Math.max(4, score)}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums">
        {confidence === "low" ? "~" : ""}
        {score}
      </span>
      {typeof delta === "number" && delta !== 0 && (
        <span className={`w-12 shrink-0 text-right text-xs font-medium ${delta > 0 ? "text-success" : "text-danger"}`}>
          {delta > 0 ? "+" : ""}
          {delta}
        </span>
      )}
      {confidence === "low" && <span className="shrink-0 text-xs text-warning">low conf.</span>}
    </div>
  );
}
