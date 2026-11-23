import { supabase } from "@/lib/supabase";
import { handler, json } from "@/lib/http";
import { safeEqual } from "@/lib/session";
import { publishScan } from "@/lib/publish";
import { isMissed } from "@/lib/post-schedule";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const BATCH = 4; // each upload can take ~30–60s
const STUCK_MINUTES = 15;

// Vercel Cron calls this every few minutes (vercel.json) with "Authorization: Bearer $CRON_SECRET".
// It sends every booking whose time has come through the connected account.
export const GET = handler(async (req) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return json({ error: "CRON_SECRET is not set." }, 503);
  const auth = req.headers.get("authorization") ?? "";
  if (!safeEqual(auth, `Bearer ${secret}`)) return json({ error: "Unauthorized." }, 401);

  const db = supabase();
  const now = new Date();

  // A run that died mid-upload leaves its row in "posting"; don't retry it blindly (it may have posted).
  await db
    .from("scheduled_posts")
    .update({ status: "failed", error: "Timed out while posting. Check the platform, then post again if it's not there.", updated_at: now.toISOString() })
    .eq("status", "posting")
    .lt("updated_at", new Date(now.getTime() - STUCK_MINUTES * 60_000).toISOString());

  const { data: due, error } = await db
    .from("scheduled_posts")
    .select("id, scan_id, platform, run_at, privacy, cover_seconds")
    .eq("status", "scheduled")
    .lte("run_at", now.toISOString())
    .order("run_at")
    .limit(BATCH);
  if (error) throw new Error(error.message);

  const results: { id: string; status: string; error?: string }[] = [];
  for (const b of due ?? []) {
    // Claim it, so an overlapping run can't post it twice.
    const { data: claimed } = await db
      .from("scheduled_posts")
      .update({ status: "posting", updated_at: new Date().toISOString() })
      .eq("id", b.id)
      .eq("status", "scheduled")
      .select("id");
    if (!claimed?.length) continue;

    if (isMissed(new Date(b.run_at as string), now)) {
      await db
        .from("scheduled_posts")
        .update({ status: "missed", error: "The publisher reached it over 3 hours late, so it wasn't sent. Pick a new time.", updated_at: new Date().toISOString() })
        .eq("id", b.id);
      results.push({ id: b.id, status: "missed" });
      continue;
    }

    try {
      const post = await publishScan(b.scan_id as string, b.platform as "tiktok" | "youtube", {
        privacy: b.privacy as string | null,
        coverSeconds: b.cover_seconds == null ? null : Number(b.cover_seconds),
      });
      await db
        .from("scheduled_posts")
        .update({ status: "posted", social_post_id: post.id, error: null, updated_at: new Date().toISOString() })
        .eq("id", b.id);
      results.push({ id: b.id, status: "posted" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Posting failed.";
      await db.from("scheduled_posts").update({ status: "failed", error: message, updated_at: new Date().toISOString() }).eq("id", b.id);
      results.push({ id: b.id, status: "failed", error: message });
    }
  }
  return json({ checked: (due ?? []).length, results });
});
