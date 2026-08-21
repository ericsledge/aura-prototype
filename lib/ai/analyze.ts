// Server-only. Real replacement for lib/mock/mockAnalysis.ts's runMockAnalysis —
// same AuraModelOutput contract, so nothing downstream (scoring, comparison, UI)
// needs to change. Never import this from a "use client" file; OPENAI_API_KEY
// must never reach the browser.

import "server-only";
import OpenAI from "openai";
import { AuraModelOutput, Goal } from "@/lib/types/aura";
import { AURA_MODEL_OUTPUT_SCHEMA } from "@/lib/ai/schema";
import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/ai/prompt";
import { validateModelOutput } from "@/lib/ai/validate";

// "gpt-4o" is no longer offered as of Aug 2026 — confirmed via
// platform.openai.com/docs/models. gpt-5.6-terra balances intelligence and
// cost; override with OPENAI_MODEL if a different tier fits better.
export const MODEL = process.env.OPENAI_MODEL || "gpt-5.6-terra";

export interface AnalyzeImageInput {
  viewType: string;
  dataUrl: string;
}

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("ai_not_configured: OPENAI_API_KEY is not set");
  }
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export async function analyzeWithOpenAI(images: AnalyzeImageInput[], goal: Goal): Promise<AuraModelOutput> {
  const openai = getClient();

  const response = await openai.chat.completions.create({
    model: MODEL,
    // gpt-5.6-* (reasoning models) reject any temperature other than the
    // default (1) — confirmed via a live 400 from the API. Whatever run-to-run
    // variance exists at the default is exactly what tools/stability-test.ts
    // is for measuring; it's not something we can dial down for these models.
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: buildUserPrompt(goal) },
          ...images.map((img) => ({
            type: "image_url" as const,
            image_url: { url: img.dataUrl, detail: "high" as const },
          })),
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: AURA_MODEL_OUTPUT_SCHEMA,
    },
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error("ai_empty_response");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("ai_invalid_json");
  }

  return validateModelOutput(parsed);
}
