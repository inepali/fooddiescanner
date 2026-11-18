-- Member accounts: Supabase email + password sign-in. Before rewards can be paid we ask
-- for a confirmed email (Supabase Auth), a phone number and a TikTok handle.
-- TikTok sign-in (OAuth) may replace the typed handle later.

alter table creators
  add column if not exists phone text check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  add column if not exists tiktok_handle text check (tiktok_handle ~ '^[a-z0-9._]{2,24}$');

create unique index if not exists creators_phone_key on creators (phone) where phone is not null;
create unique index if not exists creators_tiktok_key on creators (tiktok_handle) where tiktok_handle is not null;

-- Join with an invite code, atomically: the code is locked, checked and used in one step,
-- so two people can't both take the last use. Pass p_code null for open sign-up.
-- Returns the new member's tier. Raises 'invalid_invite' or 'handle_taken'.
create or replace function join_with_invite(p_user uuid, p_code text, p_handle text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  inv invites%rowtype;
  t text := 'scanner';
begin
  if p_code is not null then
    select * into inv from invites where code = p_code for update;
    if inv.code is null or inv.uses >= inv.max_uses or (inv.expires_at is not null and inv.expires_at <= now()) then
      raise exception 'invalid_invite';
    end if;
    update invites set uses = uses + 1 where code = p_code;
    t := inv.tier;
  end if;

  begin
    insert into creators (id, handle, tier, invited_by)
    values (p_user, p_handle, t, inv.created_by);
  exception when unique_violation then
    raise exception 'handle_taken';
  end;
  return t;
end;
$$;

revoke execute on function join_with_invite(uuid, text, text) from public, anon, authenticated;
