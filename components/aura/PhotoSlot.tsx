"use client";

import { useRef } from "react";
import { Badge } from "@/components/ui/Card";
import { QUALITY_ISSUE_LABELS } from "@/lib/quality";

export interface SlotState {
  status: "empty" | "analyzing" | "ready";
  dataUrl?: string;
  issues: string[];
  usable: boolean;
}

export function PhotoSlot({
  label,
  hint,
  state,
  onFile,
  onRemove,
  capture,
}: {
  label: string;
  hint: string;
  state: SlotState;
  onFile: (file: File) => void;
  onRemove: () => void;
  capture?: "user" | "environment";
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">{label}</h3>
          <p className="text-xs text-muted">{hint}</p>
        </div>
        {state.status === "ready" && (
          <Badge tone={state.usable ? "success" : "warning"}>{state.usable ? "Comparable" : "Needs retake"}</Badge>
        )}
        {state.status === "analyzing" && <Badge>Checking…</Badge>}
      </div>

      <div className="mt-3">
        {state.dataUrl ? (
          <div className="relative overflow-hidden rounded-xl border border-border-subtle">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={state.dataUrl} alt={label} className="h-40 w-full object-cover" />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-subtle text-sm text-muted hover:border-accent hover:text-foreground"
          >
            <span className="text-2xl">+</span>
            Upload photo
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture={capture}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {state.issues.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-warning">
          {state.issues.map((issue) => (
            <li key={issue}>• {QUALITY_ISSUE_LABELS[issue] ?? issue}</li>
          ))}
        </ul>
      )}

      {state.dataUrl && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-xs text-accent-soft hover:underline"
          >
            Replace
          </button>
          <button type="button" onClick={onRemove} className="text-xs text-muted hover:text-danger">
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
