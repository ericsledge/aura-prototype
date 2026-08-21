"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { saveFeedback } from "@/lib/store/auraStore";

// Pilot protocol (Bible §82) explicitly wants to know what felt fake or accurate.
// This is the cheapest possible capture of that signal, tied to the exact scan.
export function FeedbackPrompt({ scanId }: { scanId: string }) {
  const [answer, setAnswer] = useState<"helpful" | "not_helpful" | null>(null);

  async function submit(scoreFeltStable: boolean) {
    await saveFeedback({
      scanId,
      helpful: null,
      scoreFeltStable,
      recommendationUsed: null,
      notes: "",
    });
    setAnswer(scoreFeltStable ? "helpful" : "not_helpful");
  }

  if (answer) {
    return (
      <Card className="text-center text-sm text-muted">
        Thanks — that helps us track score stability across real testers.
      </Card>
    );
  }

  return (
    <Card className="flex items-center justify-between gap-3">
      <span className="text-sm">Did this comparison feel accurate?</span>
      <div className="flex gap-2">
        <button
          onClick={() => submit(true)}
          className="rounded-full border border-border-subtle px-3 py-1.5 text-sm hover:border-success hover:text-success"
        >
          👍
        </button>
        <button
          onClick={() => submit(false)}
          className="rounded-full border border-border-subtle px-3 py-1.5 text-sm hover:border-danger hover:text-danger"
        >
          👎
        </button>
      </div>
    </Card>
  );
}
