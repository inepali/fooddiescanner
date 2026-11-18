import { NextResponse } from "next/server";
import { newInviteCode } from "@/lib/members";
import { supabase } from "@/lib/supabase";

// Admin only: /api/* sits behind APP_PASSWORD in middleware (it is not in the public list).

/** GET → your invite codes, newest first. */
export async function GET() {
  const { data, error } = await supabase()
    .from("invites")
    .select("code, tier, uses, max_uses, expires_at, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invites: data });
}

/** POST { tier?: "scanner" | "creator", max_uses?: number, days?: number } → a new code. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const tier = body.tier === "creator" ? "creator" : "scanner";
  const maxUses = Math.min(Math.max(Math.round(Number(body.max_uses) || 1), 1), 1000);
  const days = Number(body.days);
  const expires_at = Number.isFinite(days) && days > 0 ? new Date(Date.now() + days * 86_400_000).toISOString() : null;

  const db = supabase();
  for (let i = 0; i < 3; i++) {
    const code = newInviteCode();
    const { error } = await db.from("invites").insert({ code, tier, max_uses: maxUses, expires_at });
    if (!error) return NextResponse.json({ code, tier, max_uses: maxUses, expires_at });
    if (error.code !== "23505") return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ error: "Couldn’t make a unique code. Try again." }, { status: 500 });
}
