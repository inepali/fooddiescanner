-- Auto-advance the scan steps after 2 minutes without a tap (off by default, it spends voice credits).
alter table settings add column if not exists auto_advance boolean not null default false;
