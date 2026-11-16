import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_DAYS, createSession, safeEqual, safeNext } from "@/lib/session";

/** POST { password, next } → sets the session cookie and returns where to go. */
export async function POST(req: Request) {
  const pass = process.env.APP_PASSWORD;
  const body = (await req.json().catch(() => ({}))) as { password?: unknown; next?: unknown };
  const next = safeNext(typeof body.next === "string" ? body.next : null);
  if (!pass) return NextResponse.json({ ok: true, next });

  const given = typeof body.password === "string" ? body.password : "";
  if (!safeEqual(given, pass)) {
    // A short pause makes guessing slow without bothering a real person.
    await new Promise((r) => setTimeout(r, 700));
    return NextResponse.json({ ok: false, error: "That password isn’t right." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, next });
  res.cookies.set(SESSION_COOKIE, await createSession(pass), {
    httpOnly: true,
    secure: new URL(req.url).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  return res;
}
