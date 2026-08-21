"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useHydrated } from "@/lib/hooks/useHydrated";

function readRetakeIssues(): string[] {
  try {
    const raw = sessionStorage.getItem("aura.retakeIssues");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// A capture problem is not character progression: this screen exists so an
// unusable scan never gets presented as a real (if bad) measurement — no
// score, no "retake" mission mixed into the normal queue, no XP. It's a
// dead end back to Upload, not a stop on the Aura Journey.
export default function RetakeNeededPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const issues = hydrated ? readRetakeIssues() : [];

  if (!hydrated) return null;

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-6 px-5 py-16 text-center">
      <span className="text-xs uppercase tracking-[0.2em] text-warning">Scan Quality: Retake Recommended</span>
      <h1 className="text-2xl font-bold tracking-tight">We need a better scan first</h1>
      <p className="text-muted">
        Your photos didn&apos;t give Aura enough reliable information to evaluate your build. This is about the
        photos, not you — nothing was scored, and nothing was added to your Journey.
      </p>

      <Card className="w-full text-left">
        <p className="mb-2 text-xs uppercase tracking-wide text-muted">Fix these</p>
        {issues.length > 0 ? (
          <ul className="flex flex-col gap-2 text-sm">
            {issues.map((issue, i) => (
              <li key={i}>• {issue}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">
            Try more even lighting, make sure the required view is fully visible, and avoid filters or heavy crops.
          </p>
        )}
      </Card>

      <Button size="lg" className="w-full" onClick={() => router.push("/scan/upload")}>
        Retake My Scan
      </Button>
    </div>
  );
}
