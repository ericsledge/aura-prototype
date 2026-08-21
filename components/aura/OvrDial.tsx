"use client";

import { Confidence } from "@/lib/types/aura";

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence — retake recommended",
};

export function OvrDial({
  score,
  confidence,
  size = 220,
  delta,
}: {
  score: number;
  confidence: Confidence;
  size?: number;
  delta?: number;
}) {
  const radius = size / 2 - 12;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, score)) / 100;
  const offset = circumference * (1 - progress);

  return (
    <div className="animate-reveal flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} stroke="var(--border-subtle)" strokeWidth={12} fill="none" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#ovrGradient)"
            strokeWidth={12}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.16, 1, 0.3, 1)" }}
          />
          <defs>
            <linearGradient id="ovrGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7c5cff" />
              <stop offset="100%" stopColor="#a78bff" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">Aura</span>
          <span className="text-5xl font-bold tabular-nums">
            {confidence === "low" && <span className="text-muted">~</span>}
            {score}
          </span>
          <span className="text-xs text-muted">OVR</span>
          {typeof delta === "number" && (
            <span className={`mt-1 text-sm font-medium ${delta > 0 ? "text-success" : delta < 0 ? "text-danger" : "text-muted"}`}>
              {delta > 0 ? "+" : ""}
              {delta}
            </span>
          )}
        </div>
      </div>
      <span className="text-xs text-muted">{CONFIDENCE_LABEL[confidence]}</span>
    </div>
  );
}
