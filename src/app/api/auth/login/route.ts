import { NextResponse } from "next/server";
import { authClient } from "@/lib/member-auth";
import { normalizeEmail } from "@/lib/members";
import { SESSION_COOKIE, SESSION_DAYS, adminEmails, createSession, safeEqual, safeNext, sessionSecret } from "@/lib/session";

/**
 * POST { email, password, next } → sets the admin session cookie and returns where to go.
 * With ADMIN_EMAILS set: the email must be listed and its Supabase Auth password must match.
 * Without it: the old single APP_PASSWORD (email ignored).
 */
export async function POST(req: Request) {
  const secret = sessionSecret();
  const body = (await req.json().catch(() => ({}))) as { email?: unknown; password?: unknown; next?: unknown };
  const next = safeNext(typeof body.next === "string" ? body.next : null);
  if (!secret) return NextResponse.json({ ok: true, next });

  const password = typeof body.password === "string" ? body.password : "";
  const admins = adminEmails();
  let allowed = false;
  if (admins.length > 0) {
    const email = normalizeEmail(body.email);
    if (email && admins.includes(email) && password) {
      const { data, error } = await authClient().auth.signInWithPassword({ email, password });
      allowed = !error && Boolean(data.user?.email_confirmed_at) && admins.includes((data.user?.email ?? "").toLowerCase());
    }
  } else {
    const pass = process.env.APP_PASSWORD ?? "";
    allowed = Boolean(pass) && safeEqual(password, pass);
  }

  if (!allowed) {
    // A short pause makes guessing slow without bothering a real person.
    await new Promise((r) => setTimeout(r, 700));
    const error = admins.length > 0 ? "That email or password isn’t right." : "That password isn’t right.";
    return NextResponse.json({ ok: false, error }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, next });
  res.cookies.set(SESSION_COOKIE, await createSession(secret), {
    httpOnly: true,
    secure: new URL(req.url).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  return res;
}
