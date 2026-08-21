"use client";

import { AuraModelOutput, Goal, PhotoViewType } from "@/lib/types/aura";

export interface AnalysisResult {
  modelOutput: AuraModelOutput;
  model: string;
}

export async function requestAnalysis(
  images: { viewType: PhotoViewType; dataUrl: string }[],
  goal: Goal
): Promise<AnalysisResult> {
  const res = await fetch("/api/aura/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images, goal }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error ?? `analyze_failed_${res.status}`);
  }

  return (await res.json()) as AnalysisResult;
}
