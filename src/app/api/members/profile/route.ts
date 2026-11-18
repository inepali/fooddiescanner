import { NextResponse } from "next/server";
import { isSecure, memberFromToken, readMemberCookies, refreshMember, setMemberCookies } from "@/lib/member-auth";
import { normalizePhone, normalizeTiktok } from "@/lib/members";
import { supabase } from "@/lib/supabase";

/** POST { phone, tiktok } → saves the details we need before paying rewards. Empty clears a field. */
export async function POST(req: Request) {
  const cookies = readMemberCookies(req);
  let member = await memberFromToken(cookies.access);
  const fresh = member ? null : await refreshMember(cookies.refresh);
  member = member ?? fresh?.member ?? null;
  if (!member) return NextResponse.json({ ok: false, error: "Sign in again." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const update: { phone?: string | null; tiktok_handle?: string | null } = {};
  if ("phone" in body) {
    const raw = typeof body.phone === "string" ? body.phone.trim() : "";
    const phone = raw ? normalizePhone(raw) : null;
    if (raw && !phone) return NextResponse.json({ ok: false, error: "Enter a valid phone number, e.g. (704) 555-0123 or +977…" }, { status: 400 });
    update.phone = phone;
  }
  if ("tiktok" in body) {
    const raw = typeof body.tiktok === "string" ? body.tiktok.trim() : "";
    const tiktok = raw ? normalizeTiktok(raw) : null;
    if (raw && !tiktok) return NextResponse.json({ ok: false, error: "Enter your TikTok username, e.g. @yourname." }, { status: 400 });
    update.tiktok_handle = tiktok;
  }

  const { error } = await supabase().from("creators").update(update).eq("id", member.id);
  if (error) {
    const dup = error.code === "23505";
    return NextResponse.json(
      { ok: false, error: dup ? "That phone number or TikTok is already on another account." : "Couldn’t save. Try again." },
      { status: dup ? 409 : 500 },
    );
  }
  const res = NextResponse.json({
    ok: true,
    phone: "phone" in update ? update.phone : member.phone,
    tiktok: "tiktok_handle" in update ? update.tiktok_handle : member.tiktok,
  });
  if (fresh) setMemberCookies(res, fresh.session, isSecure(req));
  return res;
}
