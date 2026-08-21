"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WizardShell } from "@/components/aura/WizardShell";
import { Button } from "@/components/ui/Button";
import { GOAL_LABELS, Goal } from "@/lib/types/aura";
import { saveDraft, saveProfile } from "@/lib/store/auraStore";

const GOALS: Goal[] = [
  "overall_improvement",
  "better_grooming",
  "better_style",
  "better_photos",
  "look_put_together",
  "other",
];

export default function GoalPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Goal | null>(null);

  async function handleContinue() {
    if (!selected) return;
    saveDraft({ scanType: "baseline", baselineScanId: null, goal: selected });
    await saveProfile({ primaryGoal: selected });
    router.push("/scan/capture-tutorial");
  }

  return (
    <WizardShell step={2} title="What's your main goal?" subtitle="One tap — we'll tailor your plan to this." backHref="/scan/age-gate">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {GOALS.map((goal) => (
          <button
            key={goal}
            onClick={() => setSelected(goal)}
            className={`rounded-2xl border p-4 text-left text-sm font-medium transition-colors ${
              selected === goal
                ? "border-accent bg-accent/10 text-foreground"
                : "border-border-subtle bg-surface text-muted hover:border-accent/50"
            }`}
          >
            {GOAL_LABELS[goal]}
          </button>
        ))}
      </div>
      <Button size="lg" disabled={!selected} onClick={handleContinue} className="mt-8 w-full">
        Continue
      </Button>
    </WizardShell>
  );
}
