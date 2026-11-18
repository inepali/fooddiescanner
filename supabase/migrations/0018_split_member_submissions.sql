-- Scanners and video contributors submit separately.
--   scan  = ingredient label photo + product photo. Read and scored on submit; earns points (0015).
--   video = product photo + the member's own ~60 s video + product name. Not read by AI; you add
--           the label (or barcode) yourself, generate the final video, then accept it.
-- Both wait in History / Review as "Waiting for review". Accepting one leaves the member a notice.

alter table scans
  add column if not exists submission_kind text check (submission_kind in ('scan', 'video'));

-- Every member submission so far was a full scan (label + photo + video).
update scans set submission_kind = 'scan' where creator_id is not null and submission_kind is null;

create index if not exists scans_creator_kind_idx on scans (creator_id, submission_kind, submitted_at desc)
  where creator_id is not null;

-- Notices for members ("Your video was accepted"). One of each kind per submission.
create table if not exists member_notifications (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators on delete cascade,
  scan_id uuid references scans on delete cascade,
  kind text not null check (kind in ('accepted')),
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (scan_id, kind)
);
create index if not exists member_notifications_unread_idx on member_notifications (creator_id, created_at desc)
  where read_at is null;

-- Server-only, like every other table (0003).
alter table member_notifications enable row level security;

-- Video submissions don't earn scan points: when you analyze one yourself, the contributor
-- shouldn't get scan / first-to-scan points for your label read. Same as 0015 otherwise.
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
  select id, creator_id, status, off_code, created_at, submission_kind into s from scans where id = p_scan_id;
  if s.id is null or s.creator_id is null or s.status <> 'analyzed' or s.submission_kind = 'video' then
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

revoke execute on function award_scan_points(uuid) from public, anon, authenticated;
