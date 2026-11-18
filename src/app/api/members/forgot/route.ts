import { NextResponse } from "next/server";
import { authClient } from "@/lib/member-auth";
import { normalizeEmail } from "@/lib/members";

/**
 * POST { email, to?: "login" } → Supabase emails a reset link that opens /reset.
 * Always answers the same way, so nobody can use this to find out who has an account.
 * Add `${APP_URL}/reset` to Supabase Auth → URL Configuration → Redirect URLs.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: unknown; to?: unknown };
  const email = normalizeEmail(body.email);
  if (!email) return NextResponse.json({ ok: false, error: "Enter a valid email." }, { status: 400 });

  const site = process.env.APP_URL || new URL(req.url).origin;
  const back = body.to === "login" ? "?to=login" : "";
  const { error } = await authClient().auth.resetPasswordForEmail(email, { redirectTo: `${site}/reset${back}` });
  if (error) {
    if (error.status === 429) {
      return NextResponse.json({ ok: false, error: "Too many reset emails. Wait a few minutes and try again." }, { status: 429 });
    }
    console.error("resetPasswordForEmail failed:", error.message);
  }
  return NextResponse.json({ ok: true });
}
