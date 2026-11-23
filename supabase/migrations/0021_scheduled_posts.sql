-- Posts booked for a set time. The app suggests the time (best-time slots, src/lib/post-schedule.ts);
-- a Vercel cron (/api/cron/publish) sends due ones through the connected account.
--   via = 'app'        the app publishes it at run_at (needs the account connected)
--   via = 'metricool'  you scheduled it in Metricool yourself; the row only reserves the slot
--                      so the next suggestion moves on
-- status:
--   scheduled  waiting for run_at
--   posting    the cron has picked it up
--   posted     sent (social_post_id links the post record)
--   failed     sending failed (see error)
--   missed     the cron reached it too late (3h+), so it was not sent at a bad time
--   canceled   you canceled it
--   external   booked in Metricool
create table if not exists scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references scans on delete cascade,
  platform text not null check (platform in ('tiktok', 'youtube')),
  run_at timestamptz not null,
  via text not null default 'app' check (via in ('app', 'metricool')),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'posting', 'posted', 'failed', 'missed', 'canceled', 'external')),
  privacy text,
  cover_seconds numeric,
  social_post_id uuid references social_posts on delete set null,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists scheduled_posts_due_idx on scheduled_posts (status, run_at);
create index if not exists scheduled_posts_scan_idx on scheduled_posts (scan_id);
-- One live booking per scan per platform.
create unique index if not exists scheduled_posts_one_live
  on scheduled_posts (scan_id, platform) where status in ('scheduled', 'posting', 'external');

-- Server-only like every other table (0003).
alter table scheduled_posts enable row level security;
