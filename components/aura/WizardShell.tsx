"use client";

import Link from "next/link";

const STEPS = ["Age", "Goal", "Tutorial", "Upload", "Analysis"];

export function WizardShell({
  step,
  title,
  subtitle,
  backHref,
  onBack,
  children,
}: {
  step: number; // 1-indexed, matches STEPS
  title: string;
  subtitle?: string;
  backHref?: string;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-73px)] max-w-lg flex-col px-5 py-8">
      <div className="mb-6 flex items-center gap-3">
        {onBack ? (
          <button onClick={onBack} className="text-sm text-muted hover:text-foreground">
            ← Back
          </button>
        ) : backHref ? (
          <Link href={backHref} className="text-sm text-muted hover:text-foreground">
            ← Back
          </Link>
        ) : (
          <span />
        )}
        <div className="ml-auto flex gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-6 rounded-full ${i < step ? "bg-accent" : "bg-surface-elevated"}`}
            />
          ))}
        </div>
      </div>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
      <div className="mt-8 flex-1">{children}</div>
    </div>
  );
}
