-- Aura Phase 3 prototype schema.
-- Mirrors lib/types/aura.ts and the Bible's prototype data model (§79).
-- Not yet applied — this ships with the repo so Stage 5 (Supabase wiring) is a
-- straight `supabase db push`, not a schema design exercise.

create extension if not exists "pgcrypto";

-- ---- profiles ----

create table if not exists profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  age_gate_confirmed boolean not null default false,
  primary_goal text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles_select_own" on profiles for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = user_id);

-- ---- scans ----

create table if not exists scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scan_type text not null check (scan_type in ('baseline', 'rescan')),
  status text not null check (status in ('draft', 'processing', 'complete', 'failed')) default 'draft',
  goal text not null,
  baseline_scan_id uuid references scans (id) on delete set null,
  overall_score integer,
  overall_confidence text check (overall_confidence in ('low', 'medium', 'high')),
  model_output jsonb,
  model_version text,
  rubric_version text,
  scoring_version text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table scans enable row level security;

create policy "scans_select_own" on scans for select using (auth.uid() = user_id);
create policy "scans_insert_own" on scans for insert with check (auth.uid() = user_id);
create policy "scans_update_own" on scans for update using (auth.uid() = user_id);
create policy "scans_delete_own" on scans for delete using (auth.uid() = user_id);

-- ---- scan_images ----
-- storage_path points into a private Supabase Storage bucket ("scan-photos"),
-- never a public URL. Access is via short-lived signed URLs only.

create table if not exists scan_images (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references scans (id) on delete cascade,
  view_type text not null check (view_type in ('front', 'three_quarter', 'full_body')),
  storage_path text not null,
  width integer,
  height integer,
  size_bytes integer,
  quality_flags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table scan_images enable row level security;

create policy "scan_images_select_own" on scan_images for select using (
  exists (select 1 from scans where scans.id = scan_images.scan_id and scans.user_id = auth.uid())
);
create policy "scan_images_modify_own" on scan_images for all using (
  exists (select 1 from scans where scans.id = scan_images.scan_id and scans.user_id = auth.uid())
);

-- ---- scan_categories ----

create table if not exists scan_categories (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references scans (id) on delete cascade,
  category text not null,
  score integer not null,
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  evidence jsonb not null default '[]'::jsonb,
  controllable_factors jsonb not null default '[]'::jsonb,
  unique (scan_id, category)
);

alter table scan_categories enable row level security;

create policy "scan_categories_select_own" on scan_categories for select using (
  exists (select 1 from scans where scans.id = scan_categories.scan_id and scans.user_id = auth.uid())
);
create policy "scan_categories_modify_own" on scan_categories for all using (
  exists (select 1 from scans where scans.id = scan_categories.scan_id and scans.user_id = auth.uid())
);

-- ---- missions ----

create table if not exists missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_scan_id uuid not null references scans (id) on delete cascade,
  category text not null,
  title text not null,
  action text not null,
  reason text not null,
  impact_band text not null check (impact_band in ('low', 'medium', 'high')),
  effort_band text not null check (effort_band in ('low', 'medium', 'high')),
  cost_band text not null check (cost_band in ('free', 'low', 'medium', 'high')),
  time_horizon text,
  success_check text,
  status text not null check (status in ('suggested', 'active', 'completed', 'dismissed')) default 'suggested',
  started_at timestamptz,
  completed_at timestamptz,
  note text
);

alter table missions enable row level security;

create policy "missions_select_own" on missions for select using (auth.uid() = user_id);
create policy "missions_modify_own" on missions for all using (auth.uid() = user_id);

-- ---- scan_comparisons ----

create table if not exists scan_comparisons (
  id uuid primary key default gen_random_uuid(),
  baseline_scan_id uuid not null references scans (id) on delete cascade,
  current_scan_id uuid not null references scans (id) on delete cascade,
  comparability_score numeric not null,
  overall_delta integer not null,
  category_deltas jsonb not null default '[]'::jsonb,
  what_changed jsonb not null default '[]'::jsonb,
  possible_noise jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table scan_comparisons enable row level security;

create policy "scan_comparisons_select_own" on scan_comparisons for select using (
  exists (select 1 from scans where scans.id = scan_comparisons.current_scan_id and scans.user_id = auth.uid())
);
create policy "scan_comparisons_modify_own" on scan_comparisons for all using (
  exists (select 1 from scans where scans.id = scan_comparisons.current_scan_id and scans.user_id = auth.uid())
);

-- ---- feedback ----

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scan_id uuid references scans (id) on delete set null,
  helpful boolean,
  score_felt_stable boolean,
  recommendation_used boolean,
  notes text,
  created_at timestamptz not null default now()
);

alter table feedback enable row level security;

create policy "feedback_select_own" on feedback for select using (auth.uid() = user_id);
create policy "feedback_insert_own" on feedback for insert with check (auth.uid() = user_id);

-- ---- experiment_exposures ----

create table if not exists experiment_exposures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  experiment_key text not null,
  variant text not null,
  exposed_at timestamptz not null default now()
);

alter table experiment_exposures enable row level security;

create policy "experiment_exposures_select_own" on experiment_exposures for select using (auth.uid() = user_id);
create policy "experiment_exposures_insert_own" on experiment_exposures for insert with check (auth.uid() = user_id);

-- ---- analytics_events ----

create table if not exists analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  event text not null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table analytics_events enable row level security;

create policy "analytics_events_insert_own" on analytics_events for insert with check (auth.uid() = user_id);
