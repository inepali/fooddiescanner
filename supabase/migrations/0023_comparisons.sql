-- Comparison videos: 2 to 4 already-scanned products, one AI script with a verdict,
-- one voiceover and one long (3-5 minute) video made from the products' own footage.
create table comparisons (
  id uuid primary key default gen_random_uuid(),
  title text,
  scan_ids uuid[] not null check (cardinality(scan_ids) between 2 and 4),
  -- JSON CompareScript (see src/lib/compare-script.ts): scenes, verdict, title.
  script text,
  -- The winner you forced (1-based index into scan_ids), or null to let the AI decide.
  forced_winner int check (forced_winner between 1 and 4),
  voice_id text,
  audio_path text,
  duration_s numeric,
  alignment jsonb,
  words jsonb,
  video_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on comparisons (created_at desc);
alter table comparisons enable row level security; -- server-only access, like every table here

-- Jobs can now belong to a comparison instead of a scan (script, voice and render steps reuse the same names).
alter table jobs alter column scan_id drop not null;
alter table jobs add column comparison_id uuid references comparisons on delete cascade;
alter table jobs add constraint jobs_owner_check check (scan_id is not null or comparison_id is not null);
create index on jobs (comparison_id, step);
