// JSON Schema for OpenAI Structured Outputs — forces the model to return
// exactly the AuraModelOutput shape (lib/types/aura.ts) instead of free-form
// prose. This is the "Stage 1: input-quality and observable feature
// extraction" contract from the Bible (§78) — the model only ever supplies
// evidence and provisional scores; lib/scoring computes the real numbers.

import { AURA_CATEGORIES } from "@/lib/types/aura";

const CONFIDENCE_ENUM = ["low", "medium", "high"];
const BAND_ENUM = ["low", "medium", "high"];
const COST_ENUM = ["free", "low", "medium", "high"];
const MISSION_TYPE_ENUM = ["quick_win", "standard", "long_term"];

const categorySchema = {
  type: "object",
  properties: {
    name: { type: "string", enum: [...AURA_CATEGORIES] },
    provisional_score: { type: "integer", minimum: 0, maximum: 100 },
    confidence: { type: "string", enum: CONFIDENCE_ENUM },
    evidence: { type: "array", items: { type: "string" }, maxItems: 4 },
    controllable_factors: { type: "array", items: { type: "string" }, maxItems: 3 },
    unknowns: { type: "array", items: { type: "string" }, maxItems: 3 },
  },
  required: ["name", "provisional_score", "confidence", "evidence", "controllable_factors", "unknowns"],
  additionalProperties: false,
};

const upgradeSchema = {
  type: "object",
  properties: {
    category: { type: "string", enum: [...AURA_CATEGORIES] },
    title: { type: "string" },
    action: { type: "string" },
    reason: { type: "string" },
    impact_band: { type: "string", enum: BAND_ENUM },
    effort_band: { type: "string", enum: BAND_ENUM },
    cost_band: { type: "string", enum: COST_ENUM },
    time_horizon: { type: "string" },
    success_check: { type: "string" },
    mission_type: { type: "string", enum: MISSION_TYPE_ENUM },
    steps: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 5 },
  },
  required: [
    "category",
    "title",
    "action",
    "reason",
    "impact_band",
    "effort_band",
    "cost_band",
    "time_horizon",
    "success_check",
    "mission_type",
    "steps",
  ],
  additionalProperties: false,
};

export const AURA_MODEL_OUTPUT_SCHEMA = {
  name: "aura_model_output",
  strict: true,
  schema: {
    type: "object",
    properties: {
      scan_quality: {
        type: "object",
        properties: {
          usable: { type: "boolean" },
          issues: { type: "array", items: { type: "string" }, maxItems: 6 },
          comparability_score: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["usable", "issues", "comparability_score"],
        additionalProperties: false,
      },
      categories: {
        type: "array",
        items: categorySchema,
        minItems: 7,
        maxItems: 7,
      },
      strengths: { type: "array", items: { type: "string" }, maxItems: 3 },
      opportunities: { type: "array", items: { type: "string" }, maxItems: 3 },
      recommended_upgrades: {
        type: "array",
        items: upgradeSchema,
        minItems: 3,
        maxItems: 3,
      },
      safety_flags: { type: "array", items: { type: "string" }, maxItems: 5 },
    },
    required: ["scan_quality", "categories", "strengths", "opportunities", "recommended_upgrades", "safety_flags"],
    additionalProperties: false,
  },
} as const;
