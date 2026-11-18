-- Tier 1 rewards: anyone can join, scan products into the public library and earn points
-- (no cash). Tier 2 (paid video creators) is run by hand for now and is not modelled here.
--
-- Points:
--   10  every analyzed scan you submit
--   +20 you are the first to scan that product (by Open Food Facts barcode)
-- Points are written to a ledger by award_scan_points(); clients never write points.

-- People who join. One row per Supabase Auth user.
create table if not exists creators (
  id uuid primary key references auth.users on delete cascade,
  handle text unique check (handle ~ '^[a-z0-9_]{3,24}$'),
  tier text not null default 'scanner' check (tier in ('scanner', 'creator')),
  phone_verified boolean not null default false,
  invited_by uuid references creators on delete set null,
  banned boolean not null default false,
  created_at timestamptz not null default now()
);

-- Invite codes (Tier 2 invites, or gated sign-up while the program is small).
create table if not exists invites (
  code text primary key check (code ~ '^[A-Z0-9]{6,12}$'),
  created_by uuid references creators on delete set null,
  tier text not null default 'scanner' check (tier in ('scanner', 'creator')),
  max_uses int not null default 1 check (max_uses > 0),
  uses int not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- Who submitted a scan. Null = your own scans, as before.
alter table scans add column if not exists creator_id uuid references creators on delete set null;
create index if not exists scans_creator_idx on scans (creator_id);
create index if not exists scans_off_code_idx on scans (off_code) where off_code is not null;

-- Append-only points ledger. One award of each kind per scan.
create table if not exists points_ledger (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators on delete cascade,
  scan_id uuid references scans on delete set null,
  kind text not null check (kind in ('scan', 'first_scan', 'adjustment')),
  points int not null,
  note text,
  created_at timestamptz not null default now(),
  unique (scan_id, kind)
);
create index if not exists points_ledger_creator_idx on points_ledger (creator_id, created_at desc);

-- Award points for one scan. Safe to call more than once (unique (scan_id, kind)).
-- Returns the points added by this call.
create or replace function award_scan_points(p_scan_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  added int := 0;
  n int;
begin
  select id, creator_id, status, off_code, created_at into s from scans where id = p_scan_id;
  if s.id is null or s.creator_id is null or s.status <> 'analyzed' then
    return 0;
  end if;
  if exists (select 1 from creators where id = s.creator_id and banned) then
    return 0;
  end if;

  insert into points_ledger (creator_id, scan_id, kind, points)
  values (s.creator_id, s.id, 'scan', 10)
  on conflict (scan_id, kind) do nothing;
  get diagnostics n = row_count;
  added := added + n * 10;

  -- First to scan this barcode: no earlier analyzed scan of the same product.
  if s.off_code is not null and not exists (
    select 1 from scans o
    where o.off_code = s.off_code and o.status = 'analyzed' and o.id <> s.id
      and (o.created_at < s.created_at or (o.created_at = s.created_at and o.id < s.id))
  ) then
    insert into points_ledger (creator_id, scan_id, kind, points)
    values (s.creator_id, s.id, 'first_scan', 20)
    on conflict (scan_id, kind) do nothing;
    get diagnostics n = row_count;
    added := added + n * 20;
  end if;

  return added;
end;
$$;

-- Award automatically when a creator's scan finishes analysis.
create or replace function scans_award_points_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.creator_id is not null and new.status = 'analyzed'
     and (tg_op = 'INSERT' or old.status is distinct from 'analyzed') then
    perform award_scan_points(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists scans_award_points on scans;
create trigger scans_award_points
after insert or update of status on scans
for each row execute function scans_award_points_trg();

-- Leaderboard: totals per creator (banned creators hidden).
create or replace view leaderboard as
select c.id as creator_id, c.handle, c.tier,
       coalesce(sum(l.points), 0)::int as points,
       count(*) filter (where l.kind = 'scan')::int as scans,
       count(*) filter (where l.kind = 'first_scan')::int as first_scans
from creators c
left join points_ledger l on l.creator_id = c.id
where not c.banned
group by c.id, c.handle, c.tier;

-- Server-only, like every other table (0003): RLS on, no policies.
alter table creators enable row level security;
alter table invites enable row level security;
alter table points_ledger enable row level security;
revoke all on leaderboard from anon, authenticated;
revoke execute on function award_scan_points(uuid) from public, anon, authenticated;

-- Rewards call to action for the video, as a custom voice line in the "End" slot
-- (just before the closing question). Off by default: switch it on in the Voice tab
-- once sign-up is live, so videos never promise rewards people can't get yet.
update settings
set custom_lines = custom_lines || jsonb_build_array(jsonb_build_object(
  'id', 'rewards-cta',
  'text', 'Want to know what''s in your food? Scan your pantry at fooddiescanner.com. Join, scan, and earn rewards.',
  'position', 'end',
  'enabled', false
))
where id = 1
  and not exists (select 1 from jsonb_array_elements(custom_lines) x where x->>'id' = 'rewards-cta');
