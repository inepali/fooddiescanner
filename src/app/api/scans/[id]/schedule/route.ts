import { supabase } from "@/lib/supabase";
import { HttpError, handler, json, paramId } from "@/lib/http";
import { getAccount, requireGuard } from "@/lib/social-accounts";
import { SCHEDULE_PLATFORMS, isSchedulePlatform } from "@/lib/post-schedule";
import { LIVE_STATUSES, suggestionsFor, type Booking } from "@/lib/schedule";
import { TIKTOK_PRIVACY, YOUTUBE_PRIVACY } from "@/lib/social-platforms";

export const runtime = "nodejs";

async function connectedMap() {
  const out: Record<string, boolean> = {};
  for (const p of SCHEDULE_PLATFORMS) {
    const acc = await getAccount(p);
    // A TikTok/YouTube token expiring is fine: the refresh token renews it at post time.
    out[p] = Boolean(acc);
  }
  return out as Record<(typeof SCHEDULE_PLATFORMS)[number], boolean>;
}

async function bookingsFor(scanId: string): Promise<Booking[]> {
  const { data, error } = await supabase()
    .from("scheduled_posts")
    .select("id, scan_id, platform, run_at, via, status, privacy, error, social_post_id")
    .eq("scan_id", scanId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []) as Booking[];
}

// Best upcoming times for TikTok and YouTube, this scan's bookings, and which accounts are connected.
export const GET = handler(async (_req, ctx) => {
  const id = await paramId(ctx);
  const [suggestions, bookings, connected] = await Promise.all([suggestionsFor(id), bookingsFor(id), connectedMap()]);
  return json({ suggestions, bookings, connected });
});

// Book a time. via "app": the app posts it then (account must be connected).
// via "metricool": you scheduled it in Metricool; this only reserves the slot.
export const POST = handler(async (req, ctx) => {
  requireGuard();
  const id = await paramId(ctx);
  const body = (await req.json().catch(() => ({}))) as {
    platform?: string;
    at?: string;
    via?: string;
    privacy?: string;
    cover_seconds?: number;
  };
  if (!isSchedulePlatform(body.platform)) throw new HttpError("Scheduling works for TikTok and YouTube.");
  const platform = body.platform;
  const via = body.via === "metricool" ? "metricool" : "app";
  const at = new Date(String(body.at ?? ""));
  if (Number.isNaN(at.getTime())) throw new HttpError("Pick a time.");
  if (at.getTime() < Date.now() + 2 * 60_000) throw new HttpError("Pick a time at least a few minutes from now.");
  if (at.getTime() > Date.now() + 30 * 86_400_000) throw new HttpError("Pick a time within the next 30 days.");

  const db = supabase();
  let privacy: string | null = null;
  if (via === "app") {
    if (!(await getAccount(platform))) {
      throw new HttpError(`Connect ${platform === "tiktok" ? "TikTok" : "YouTube"} first, or schedule it in Metricool and mark it here.`);
    }
    const { data: video } = await db.from("videos").select("id").eq("scan_id", id).not("video_path", "is", null).limit(1).maybeSingle();
    if (!video) throw new HttpError("Render the final video first.");
    const { count } = await db.from("social_copy").select("platform", { count: "exact", head: true }).eq("scan_id", id);
    if (!count) throw new HttpError("Generate the social copy first.");
    const allowed: readonly string[] = platform === "tiktok" ? TIKTOK_PRIVACY : YOUTUBE_PRIVACY;
    privacy = body.privacy ?? (platform === "tiktok" ? "SELF_ONLY" : "private");
    if (!allowed.includes(privacy)) throw new HttpError("Unknown privacy setting.");
  }

  const { data, error } = await db
    .from("scheduled_posts")
    .insert({
      scan_id: id,
      platform,
      run_at: at.toISOString(),
      via,
      status: via === "app" ? "scheduled" : "external",
      privacy,
      cover_seconds: platform === "tiktok" && via === "app" ? Number(body.cover_seconds ?? 1) || 1 : null,
    })
    .select("id, scan_id, platform, run_at, via, status, privacy, error, social_post_id")
    .single();
  if (error) {
    if (error.code === "23505") throw new HttpError("This video already has a booking there. Cancel it first to pick another time.", 409);
    throw new Error(error.message);
  }
  return json(data);
});

// Cancel this scan's live booking on a platform (?platform=tiktok).
export const DELETE = handler(async (req, ctx) => {
  requireGuard();
  const id = await paramId(ctx);
  const platform = new URL(req.url).searchParams.get("platform");
  if (!isSchedulePlatform(platform)) throw new HttpError("Unknown platform.");
  const { data, error } = await supabase()
    .from("scheduled_posts")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("scan_id", id)
    .eq("platform", platform)
    .in("status", LIVE_STATUSES.filter((s) => s !== "posting"))
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new HttpError("Nothing to cancel (it may already be posting).", 404);
  return json({ ok: true });
});
