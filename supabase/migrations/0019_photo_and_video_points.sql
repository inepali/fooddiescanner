-- More rewards (keep in step with POINTS in src/lib/member-scan.ts):
--   scan        10    label read (or barcode) and analyzed          (0015, unchanged)
--   first_scan  20    first to scan this barcode                    (0015, unchanged)
--   photo       20    the submission has a real product photo       (new)
--   video     1000    video submission (45 s or longer) accepted     (new, on Accept, not on upload)
-- Rejecting a submission still takes back everything it earned (0017).

alter table points_ledger drop constraint if exists points_ledger_kind_check;
alter table points_ledger add constraint points_ledger_kind_check
  check (kind in ('scan', 'first_scan', 'photo', 'video', 'adjustment'));

-- Scans: as 0018, plus 20 for the product photo.
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

  if exists (select 1 from scan_media where scan_id = s.id and kind = 'product_image') then
    insert into points_ledger (creator_id, scan_id, kind, points)
    values (s.creator_id, s.id, 'photo', 20)
    on conflict (scan_id, kind) do nothing;
    get diagnostics n = row_count;
    added := added + n * 20;
  end if;

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

-- Videos: 1000 for the video and 20 for its product photo, once you accept it.
create or replace function award_video_points(p_scan_id uuid)
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
  select id, creator_id, submission_kind, review_status into s from scans where id = p_scan_id;
  if s.id is null or s.creator_id is null or s.submission_kind <> 'video' or s.review_status <> 'approved' then
    return 0;
  end if;
  if exists (select 1 from creators where id = s.creator_id and banned) then
    return 0;
  end if;
  if not exists (select 1 from scan_media where scan_id = s.id and kind = 'product_video') then
    return 0;
  end if;

  insert into points_ledger (creator_id, scan_id, kind, points)
  values (s.creator_id, s.id, 'video', 1000)
  on conflict (scan_id, kind) do nothing;
  get diagnostics n = row_count;
  added := added + n * 1000;

  if exists (select 1 from scan_media where scan_id = s.id and kind = 'product_image') then
    insert into points_ledger (creator_id, scan_id, kind, points)
    values (s.creator_id, s.id, 'photo', 20)
    on conflict (scan_id, kind) do nothing;
    get diagnostics n = row_count;
    added := added + n * 20;
  end if;
  return added;
end;
$$;
revoke execute on function award_video_points(uuid) from public, anon, authenticated;

-- Review: as 0017, plus video points on Accept; rejecting takes back every kind.
create or replace function scans_review_points_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  earned int;
begin
  if new.review_status is not distinct from old.review_status or new.creator_id is null then
    return new;
  end if;
  if new.review_status = 'rejected' then
    select coalesce(sum(points), 0) into earned from points_ledger
    where scan_id = new.id and kind in ('scan', 'first_scan', 'photo', 'video');
    if earned > 0 then
      insert into points_ledger (creator_id, scan_id, kind, points, note)
      values (new.creator_id, new.id, 'adjustment', -earned, 'Submission rejected')
      on conflict (scan_id, kind) do nothing;
    end if;
  else
    if old.review_status = 'rejected' then
      delete from points_ledger where scan_id = new.id and kind = 'adjustment';
    end if;
    if new.review_status = 'approved' then
      perform award_video_points(new.id);
    end if;
  end if;
  return new;
end;
$$;

-- Member scans so far that came with a product photo get its 20 points (not rejected ones).
insert into points_ledger (creator_id, scan_id, kind, points, note)
select s.creator_id, s.id, 'photo', 20, 'Product photo (added with the new rewards)'
from scans s
where s.creator_id is not null and s.submission_kind = 'scan' and s.status = 'analyzed'
  and s.review_status is distinct from 'rejected'
  and exists (select 1 from scan_media m where m.scan_id = s.id and m.kind = 'product_image')
  and not exists (select 1 from creators c where c.id = s.creator_id and c.banned)
on conflict (scan_id, kind) do nothing;

-- Video submissions already accepted get their points.
select award_video_points(id) from scans where submission_kind = 'video' and review_status = 'approved';
