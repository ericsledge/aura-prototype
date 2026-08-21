# Aura — Phase 3 Prototype

Real-world appearance progression: **SCAN → SCORE → UNDERSTAND → IMPROVE → REAL-LIFE CHANGE → RESCAN → LEVEL UP.**

This is the Phase 3 proof-of-concept prototype, built per the Aura & Relationship Intelligence Master Founder
Transfer Bible (§74–82). Its only job is to test whether adults care enough about a stable, controllable-presentation
baseline to act on it and return for a real rescan — not to be the final production app.

**Live:** https://aura-prototype-seven.vercel.app

## Current stage: Stage 4 (real AI + real persistence)

```bash
npm install
npm run dev
```

Open http://localhost:3000. Without `OPENAI_API_KEY` set, photo analysis falls back to a deterministic mock for
local development (a console warning makes this obvious — see "What's real" below); with it set, every scan goes
through real GPT-4o vision analysis. Either way, accounts and all data are real Supabase — see `.env.local` (copy
from `.env.example`) for the three required Supabase variables.

## What's real vs. mocked right now

| Real | Mocked / placeholder |
|---|---|
| Full click-through flow, all required screens + mission/XP/level progression | Payments (paywall UI is real; checkout is a placeholder, no Stripe call yet) |
| Client-side photo quality checks (brightness, sharpness, resolution, duplicates) | Local dev without `OPENAI_API_KEY`: analysis falls back to `lib/mock/mockAnalysis.ts` (never in production — Vercel always has the key) |
| Real OpenAI vision analysis (`lib/ai/analyze.ts`), structured-output schema, runtime validation | |
| Deterministic scoring engine, versioned rubric (`lib/scoring/`) — the model supplies evidence, never the final number | |
| Rescan comparison logic, noise-vs-signal thresholds (`lib/scoring/compare.ts`) | |
| Real accounts (silent anonymous auth), Postgres + RLS, private photo storage (`lib/store/auraStore.ts`, `lib/supabase/`) | |
| Real account/data deletion, including the underlying auth user | |
| Analytics events, written to Supabase (`lib/analytics/events.ts`) | |

## Score stability

The biggest product risk (Bible §77) is score inconsistency. `tools/stability-test.ts` runs the same three photos
through the real pipeline N times and reports OVR/category variance against the Bible's pass thresholds (≤3 pt
OVR range, ≤5 pt per category):

```bash
npm run stability-test -- path/to/front.jpg path/to/three_quarter.jpg path/to/full_body.jpg [runs] [goal]
```

## Architecture

- **Frontend**: Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind v4, mobile-first.
- **AI**: `lib/ai/analyze.ts` (server-only) calls OpenAI with a strict JSON schema (`lib/ai/schema.ts`) and a
  safety-boundary system prompt (`lib/ai/prompt.ts`). `lib/ai/validate.ts` re-validates the response structurally
  before it's trusted — schema conformance alone isn't assumed to be enough. `lib/scoring/index.ts` is the
  deterministic scoring service that turns model evidence into a final OVR; the model itself never invents the
  final number, and mission/XP actions never touch the OVR either — only a real rescan can move it.
- **Auth**: silent anonymous Supabase accounts (`lib/supabase/session.ts`, `components/aura/AuthGate.tsx`) — no
  signup screen, real `auth.users` row per browser.
- **Database/Storage**: Supabase Postgres with RLS on every table (`supabase/migrations/0001_init.sql`), private
  per-user photo storage bucket.
- **Env vars**: see `.env.example`.

## Build order (Bible §81)

1. ~~Clickable UX, mocked analysis~~ ✅
2. ~~Real AI (OpenAI vision, structured output validation)~~ ✅
3. ~~Persistence (Supabase auth, private storage, RLS)~~ ✅
4. Rescan intelligence hardening — ongoing, watch real tester data
5. Score-stability harness ✅ built (`tools/stability-test.ts`) — run it against real test photos before pilot
6. Privacy controls ✅ / analytics ✅ / mobile polish — spot-check on a real device
7. Pilot-ready: send the live URL to real adult testers
