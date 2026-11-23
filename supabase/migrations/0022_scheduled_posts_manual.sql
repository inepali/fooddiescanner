-- Posting is manual (Metricool or "Post now"); the app no longer publishes bookings itself.
-- scheduled_posts now only reserves the times you booked in Metricool:
--   booked    you scheduled it in Metricool for run_at
--   canceled  you cleared it
-- The table was new and only held test rows, so the publisher columns go.
delete from scheduled_posts where status not in ('external', 'canceled');
drop index if exists scheduled_posts_one_live;
alter table scheduled_posts drop constraint if exists scheduled_posts_status_check;
update scheduled_posts set status = 'booked' where status = 'external';
alter table scheduled_posts
  drop column if exists via,
  drop column if exists privacy,
  drop column if exists cover_seconds,
  drop column if exists social_post_id,
  drop column if exists error,
  alter column status set default 'booked',
  add constraint scheduled_posts_status_check check (status in ('booked', 'canceled'));
create unique index if not exists scheduled_posts_one_booked
  on scheduled_posts (scan_id, platform) where status = 'booked';
