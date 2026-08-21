// Score-stability test harness (Bible §77 — "the biggest technical problem
// Aura must solve is score consistency"). Runs the SAME three photos through
// the real OpenAI pipeline N times and reports how much the OVR and each
// category swing when nothing in the input changed. That variance is the
// actual product risk; this script is how you keep it honest.
//
// Usage:
//   npm run stability-test -- <front.jpg> <three_quarter.jpg> <full_body.jpg> [runs] [goal]
//
// Requires OPENAI_API_KEY in .env.local. Uses the exact same prompt, schema,
// and deterministic scoring code as the live app (lib/ai/prompt.ts,
// lib/ai/schema.ts, lib/scoring) — this is not a separate reimplementation
// that could drift from what real users experience.

import { readFileSync } from "node:fs";
import { extname } from "node:path";
import process from "node:process";
import OpenAI from "openai";
import { SYSTEM_PROMPT, buildUserPrompt } from "../lib/ai/prompt";
import { AURA_MODEL_OUTPUT_SCHEMA } from "../lib/ai/schema";
import { validateModelOutput } from "../lib/ai/validate";
import { computeScoring } from "../lib/scoring";
import { AURA_CATEGORIES, AuraCategory, Goal } from "../lib/types/aura";

const MODEL = process.env.OPENAI_MODEL || "gpt-5.6-terra";

function fileToDataUrl(path: string): string {
  const buffer = readFileSync(path);
  const ext = extname(path).toLowerCase();
  const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

function stats(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return { min, max, range: max - min, mean: Math.round(mean * 10) / 10, stdev: Math.round(Math.sqrt(variance) * 10) / 10 };
}

async function main() {
  const [frontPath, threeQuarterPath, fullBodyPath, runsArg, goalArg] = process.argv.slice(2);
  if (!frontPath || !threeQuarterPath || !fullBodyPath) {
    console.error("Usage: npm run stability-test -- <front> <three_quarter> <full_body> [runs=5] [goal=overall_improvement]");
    process.exit(1);
  }
  const runs = runsArg ? parseInt(runsArg, 10) : 5;
  const goal = (goalArg as Goal) || "overall_improvement";

  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is not set. Run with: node --env-file=.env.local ...");
    process.exit(1);
  }

  const images = [
    { type: "image_url" as const, image_url: { url: fileToDataUrl(frontPath), detail: "high" as const } },
    { type: "image_url" as const, image_url: { url: fileToDataUrl(threeQuarterPath), detail: "high" as const } },
    { type: "image_url" as const, image_url: { url: fileToDataUrl(fullBodyPath), detail: "high" as const } },
  ];

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  console.log(`Running ${runs} identical calls against ${MODEL}...\n`);

  const overallScores: number[] = [];
  const categoryScores: Record<AuraCategory, number[]> = Object.fromEntries(
    AURA_CATEGORIES.map((c) => [c, [] as number[]])
  ) as Record<AuraCategory, number[]>;
  const categoryConfidences: Record<AuraCategory, string[]> = Object.fromEntries(
    AURA_CATEGORIES.map((c) => [c, [] as string[]])
  ) as Record<AuraCategory, string[]>;

  for (let i = 0; i < runs; i++) {
    process.stdout.write(`  run ${i + 1}/${runs}... `);
    const response = await openai.chat.completions.create({
      model: MODEL,
      // gpt-5.6-* rejects any temperature other than the default (1).
      reasoning_effort: "xhigh",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: [{ type: "text", text: buildUserPrompt(goal) }, ...images] },
      ],
      response_format: { type: "json_schema", json_schema: AURA_MODEL_OUTPUT_SCHEMA },
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new Error(`run ${i + 1}: empty response`);
    const modelOutput = validateModelOutput(JSON.parse(raw));
    const scoring = computeScoring(modelOutput);

    overallScores.push(scoring.overallScore);
    for (const c of scoring.categories) {
      categoryScores[c.category].push(c.score);
      categoryConfidences[c.category].push(c.confidence);
    }
    console.log(`OVR ${scoring.overallScore} (${scoring.overallConfidence})`);
  }

  console.log("\n--- Overall OVR ---");
  const overall = stats(overallScores);
  console.log(overallScores.join(", "));
  console.log(overall, overall.range <= 3 ? "PASS (<=3 pt range)" : "FAIL (>3 pt range)");

  console.log("\n--- Per category ---");
  for (const c of AURA_CATEGORIES) {
    const s = stats(categoryScores[c]);
    const confSummary = categoryConfidences[c].join(",");
    console.log(
      `${c.padEnd(22)} ${categoryScores[c].join(", ").padEnd(20)} range=${s.range} ${s.range <= 5 ? "PASS" : "FAIL"}  conf=[${confSummary}]`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
