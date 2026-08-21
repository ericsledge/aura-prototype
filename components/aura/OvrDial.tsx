"use client";

import { useEffect, useState } from "react";
import { Confidence } from "@/lib/types/aura";

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence — retake recommended",
};

type OvrDialProps =
  | { locked: true; size?: number }
  | { locked?: false; score: number; confidence: Confidence; size?: number; delta?: number; animateReveal?: boolean };

// Count-up animation, opt-in via animateReveal — reserved for the first-scan
// reveal (the actual magic moment). Journey/Level-up show the dial on every
// visit, so re-animating there every time would turn ceremony into fatigue;
// the Bible's own guidance is to save bigger flourish for genuinely new
// events (a new personal best), not routine views.
function useCountUp(target: number, enabled: boolean, durationMs = 1100) {
  const [animatedValue, setAnimatedValue] = useState(0);

  useEffect(() => {
    if (!enabled) return; // nothing to animate — the render below uses `target` directly
    let raf: number;
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimatedValue(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- durationMs is a constant, not reactive state
  }, [target, enabled]);

  return enabled ? animatedValue : target;
}

export function OvrDial(props: OvrDialProps) {
  const size = props.size ?? 220;
  const radius = size / 2 - 12;
  const circumference = 2 * Math.PI * radius;

  const targetScore = props.locked ? 0 : props.score;
  const displayScore = useCountUp(targetScore, !props.locked && !!props.animateReveal);

  const progress = props.locked ? 0 : Math.max(0, Math.min(100, displayScore)) / 100;
  const offset = circumference * (1 - progress);

  return (
    <div className="animate-reveal flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} stroke="var(--border-subtle)" strokeWidth={12} fill="none" />
          {!props.locked && (
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
              style={{ transition: props.animateReveal ? "none" : "stroke-dashoffset 900ms cubic-bezier(0.16, 1, 0.3, 1)" }}
            />
          )}
          <defs>
            <linearGradient id="ovrGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7c5cff" />
              <stop offset="100%" stopColor="#a78bff" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">Aura</span>
          {props.locked ? (
            <span className="text-5xl font-bold tabular-nums text-muted">??</span>
          ) : (
            <span className="text-5xl font-bold tabular-nums">
              {props.confidence === "low" && <span className="text-muted">~</span>}
              {displayScore}
            </span>
          )}
          <span className="text-xs text-muted">OVR</span>
          {!props.locked && typeof props.delta === "number" && (
            <span
              className={`mt-1 text-sm font-medium ${props.delta > 0 ? "text-success" : props.delta < 0 ? "text-danger" : "text-muted"}`}
            >
              {props.delta > 0 ? "+" : ""}
              {props.delta}
            </span>
          )}
        </div>
      </div>
      <span className="text-xs text-muted">
        {props.locked ? "Your starting score is waiting." : CONFIDENCE_LABEL[props.confidence]}
      </span>
    </div>
  );
}
