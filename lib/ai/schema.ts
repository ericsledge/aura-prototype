// JSON Schema for OpenAI Structured Outputs — forces the model to return
// exactly the AuraModelOutput shape (lib/types/aura.ts) instead of free-form
// prose. This is the "Stage 1: input-quality and observable feature
// extraction" contract from the Bible (§78) — the model only ever supplies
// evidence and discrete, structured observations; lib/scoring computes the
// real numbers (see lib/types/aura.ts for why this isn't a free continuous
// score, and why categories are broken into submetrics).

import { AURA_CATEGORIES, SCORE_TIERS } from "@/lib/types/aura";

const CONFIDENCE_ENUM = ["low", "medium", "high"];
const BAND_ENUM = ["low", "medium", "high"];
const COST_ENUM = ["free", "low", "medium", "high"];
const MISSION_TYPE_ENUM = ["quick_win", "standard", "long_term"];
const SCAN_QUALITY_RATING_ENUM = ["excellent", "good", "fair", "retake"];

// Details has its own shape (visible_details booleans + cohesion_tier), so
// the uniform "categories" array only ever contains the other five.
const NON_DETAILS_CATEGORIES = AURA_CATEGORIES.filter((c) => c !== "details");

const submetricSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    tier: { type: "string", enum: [...SCORE_TIERS] },
    confidence: { type: "string", enum: CONFIDENCE_ENUM },
  },
  required: ["name", "tier", "confidence"],
  additionalProperties: false,
};

const categorySchema = {
  type: "object",
  properties: {
    name: { type: "string", enum: [...NON_DETAILS_CATEGORIES] },
    submetrics: { type: "array", items: submetricSchema, minItems: 2, maxItems: 4 },
    tier_adjustment: { type: "integer", minimum: -5, maximum: 5 },
    confidence: { type: "string", enum: CONFIDENCE_ENUM },
    evidence: { type: "array", items: { type: "string" }, maxItems: 4 },
    controllable_factors: { type: "array", items: { type: "string" }, maxItems: 3 },
    unknowns: { type: "array", items: { type: "string" }, maxItems: 3 },
  },
  required: ["name", "submetrics", "tier_adjustment", "confidence", "evidence", "controllable_factors", "unknowns"],
  additionalProperties: false,
};

const detailsSchema = {
  type: "object",
  properties: {
    visible_details: {
      type: "object",
      properties: {
        glasses: { type: "boolean" },
        jewelry: { type: "boolean" },
        watch: { type: "boolean" },
        belt_visible: { type: "boolean" },
        footwear_visible: { type: "boolean" },
      },
      required: ["glasses", "jewelry", "watch", "belt_visible", "footwear_visible"],
      additionalProperties: false,
    },
    detail_opportunity_present: { type: "boolean" },
    submetrics: { type: "array", items: submetricSchema, minItems: 2, maxItems: 4 },
    tier_adjustment: { type: "integer", minimum: -5, maximum: 5 },
    confidence: { type: "string", enum: CONFIDENCE_ENUM },
    evidence: { type: "array", items: { type: "string" }, maxItems: 4 },
    controllable_factors: { type: "array", items: { type: "string" }, maxItems: 3 },
    unknowns: { type: "array", items: { type: "string" }, maxItems: 3 },
  },
  required: [
    "visible_details",
    "detail_opportunity_present",
    "submetrics",
    "tier_adjustment",
    "confidence",
    "evidence",
    "controllable_factors",
    "unknowns",
  ],
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
          rating: { type: "string", enum: SCAN_QUALITY_RATING_ENUM },
        },
        required: ["usable", "issues", "comparability_score", "rating"],
        additionalProperties: false,
      },
      categories: {
        type: "array",
        items: categorySchema,
        minItems: 5,
        maxItems: 5,
      },
      details: detailsSchema,
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
    required: ["scan_quality", "categories", "details", "strengths", "opportunities", "recommended_upgrades", "safety_flags"],
    additionalProperties: false,
  },
} as const;
