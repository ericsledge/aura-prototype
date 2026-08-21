# Aura — Phase 3 Prototype

Real-world appearance progression: **SCAN → SCORE → UNDERSTAND → IMPROVE → REAL-LIFE CHANGE → RESCAN → LEVEL UP.**

This is the Phase 3 proof-of-concept prototype, built per the Aura & Relationship Intelligence Master Founder
Transfer Bible (§74–82). Its only job is to test whether adults care enough about a stable, controllable-presentation
baseline to act on it and return for a real rescan — not to be the final production app.

## Current stage: Stage 3 (clickable UX, mocked analysis)

Everything runs locally in the browser with **no accounts or API keys required**:

```bash
npm install
npm run dev
```

Open http://localhost:3000. Data is stored in your browser's `localStorage` (see `lib/store/auraStore.ts`) instead
of a real database, and photo analysis is a deterministic mock (`lib/mock/mockAnalysis.ts`) instead of a real
OpenAI call — same seeded input always produces the same score, which is the whole point: score stability is the
project's biggest existential risk (Bible §77), so the mock is built to demonstrate that principle, not hide it.

## What's real vs. mocked right now

| Real today | Mocked today (swap point is isolated) |
|---|---|
| Full click-through flow, all 13 required screens | Photo "analysis" (`lib/mock/mockAnalysis.ts` → Stage 4 replaces with `lib/ai/analyze.ts` calling OpenAI, same output contract) |
| Client-side photo quality checks (brightness, sharpness, resolution, duplicates — real canvas analysis) | Persistence (`lib/store/auraStore.ts`, localStorage → Stage 5 replaces with Supabase, same function signatures) |
| Deterministic scoring engine, versioned rubric (`lib/scoring/`) | Auth (none yet — a per-browser anonymous ID stands in) |
| Rescan comparison logic, noise-vs-signal thresholds (`lib/scoring/compare.ts`) | Payments (paywall UI is real; checkout is a placeholder, no Stripe call yet) |
| Analytics event tracking (`lib/analytics/events.ts`) | |

## Architecture

- **Frontend**: Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind v4, mobile-first.
- **AI contract**: `lib/types/aura.ts` defines the structured schema every analysis result must satisfy — model
  output is never trusted as free-form prose. `lib/scoring/index.ts` is the deterministic scoring service that
  turns model evidence into a final OVR; the model itself never invents the final number.
- **Database**: schema is ready at `supabase/migrations/0001_init.sql` (not yet applied — Stage 5).
- **Env vars**: see `.env.example` — none are required until Stage 4/5.

## Build order (Bible §81)

1. ~~Clickable UX, mocked analysis~~ ✅ you are here
2. Real AI (OpenAI vision, structured output validation)
3. Persistence (Supabase auth, private storage, RLS)
4. Rescan intelligence hardening
5. Score-stability harness (exact-repeat / near-repeat variance tests, §77)
6. Privacy controls, analytics, mobile polish
7. Pilot-ready: send a URL to real adult testers
