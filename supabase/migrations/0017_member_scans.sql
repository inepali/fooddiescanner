-- Member scans: a member sends a label photo, one product photo and their own ~60 s video
-- (scan_media kind 'product_video'), then gets the ingredient breakdown back.
-- Points are awarded when the scan is analyzed (0015). You review each submission:
-- rejecting one takes its points back. Member scans stay private until you make them public.

alter table scans
  add column if not exists submitted_at timestamptz,
  add column if not exists review_status text check (review_status in ('pending', 'approved', 'rejected'));
create index if not exists scans_review_idx on scans (review_status, submitted_at desc) where review_status is not null;
create index if not exists scans_creator_created_idx on scans (creator_id, created_at desc) where creator_id is not null;

-- Length the browser read from the video before uploading (seconds).
alter table scan_media add column if not exists duration_s numeric;

-- Rejected: one negative adjustment cancels whatever the scan earned. Approved again: removed.
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
    where scan_id = new.id and kind in ('scan', 'first_scan');
    if earned > 0 then
      insert into points_ledger (creator_id, scan_id, kind, points, note)
      values (new.creator_id, new.id, 'adjustment', -earned, 'Submission rejected')
      on conflict (scan_id, kind) do nothing;
    end if;
  elsif old.review_status = 'rejected' then
    delete from points_ledger where scan_id = new.id and kind = 'adjustment';
  end if;
  return new;
end;
$$;

drop trigger if exists scans_review_points on scans;
create trigger scans_review_points
after update of review_status on scans
for each row execute function scans_review_points_trg();
