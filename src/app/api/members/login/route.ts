import { NextResponse } from "next/server";
import { authClient, isSecure, memberFromToken, setMemberCookies } from "@/lib/member-auth";
import { memberNext, normalizeEmail } from "@/lib/members";

/** POST { email, password, next } → member session cookies. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  const next = memberNext(typeof body.next === "string" ? body.next : null);
  const bad = () => NextResponse.json({ ok: false, error: "Email or password isn’t right." }, { status: 401 });
  if (!email || !password) return bad();

  const { data, error } = await authClient().auth.signInWithPassword({ email, password });
  if (error) {
    if (/confirm/i.test(error.message)) {
      return NextResponse.json({ ok: false, error: "Confirm your email first: check your inbox for the link." }, { status: 403 });
    }
    await new Promise((r) => setTimeout(r, 500));
    return bad();
  }
  if (!data.session || !(await memberFromToken(data.session.access_token))) return bad();

  const res = NextResponse.json({ ok: true, next });
  setMemberCookies(res, data.session, isSecure(req));
  return res;
}
