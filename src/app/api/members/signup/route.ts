import { NextResponse } from "next/server";
import { authClient, isSecure, setMemberCookies } from "@/lib/member-auth";
import { normalizeEmail, normalizeHandle, normalizeInviteCode, passwordProblem } from "@/lib/members";
import { supabase } from "@/lib/supabase";

// POST { email, password, handle, code } → creates the Supabase Auth user and the member row.
// Invite-only unless OPEN_SIGNUP=true. Supabase sends the confirmation email
// (Auth > Providers > Email > "Confirm email" should stay on).

const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = normalizeEmail(body.email);
  const handle = normalizeHandle(body.handle);
  const code = normalizeInviteCode(body.code);
  const open = process.env.OPEN_SIGNUP === "true";

  if (!email) return fail("Enter a valid email.");
  const pw = passwordProblem(body.password);
  if (pw) return fail(pw);
  if (!handle) return fail("Pick a username: 3–24 letters, numbers or _.");
  if (!open && !code) return fail("Enter your invite code.");

  const db = supabase();
  // Check the code and the username first, so a bad code never leaves an orphan auth user.
  if (code) {
    const { data: inv } = await db.from("invites").select("uses, max_uses, expires_at").eq("code", code).maybeSingle();
    if (!inv || inv.uses >= inv.max_uses || (inv.expires_at && new Date(inv.expires_at) <= new Date())) {
      return fail("That invite code isn’t valid or has been used.");
    }
  }
  const { data: taken } = await db.from("creators").select("id").eq("handle", handle).maybeSingle();
  if (taken) return fail("That username is taken.");

  const site = process.env.APP_URL || new URL(req.url).origin;
  const { data, error } = await authClient().auth.signUp({
    email,
    password: body.password as string,
    options: { emailRedirectTo: `${site}/signin?confirmed=1` },
  });
  if (error || !data.user) return fail(error?.message ?? "Couldn’t create the account.");
  // Supabase hides whether an email exists: an existing address comes back with no identities.
  if (data.user.identities && data.user.identities.length === 0) {
    return fail("An account with that email already exists. Sign in instead.", 409);
  }

  const { error: joinError } = await db.rpc("join_with_invite", { p_user: data.user.id, p_code: code, p_handle: handle });
  if (joinError) {
    await db.auth.admin.deleteUser(data.user.id).catch(() => {});
    const msg = joinError.message.includes("handle_taken")
      ? "That username is taken."
      : joinError.message.includes("invalid_invite")
        ? "That invite code isn’t valid or has been used."
        : "Couldn’t finish sign-up. Try again.";
    return fail(msg);
  }

  // With "Confirm email" off, Supabase returns a session right away; sign them in.
  const res = NextResponse.json({ ok: true, confirm: !data.session });
  if (data.session) setMemberCookies(res, data.session, isSecure(req));
  return res;
}
