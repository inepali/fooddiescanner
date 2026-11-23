import { supabase } from "@/lib/supabase";
import { HttpError, handler, json, paramId } from "@/lib/http";
import { requireGuard } from "@/lib/social-accounts";
import { isSchedulePlatform } from "@/lib/post-schedule";
import { suggestionsFor, type Booking } from "@/lib/schedule";

export const runtime = "nodejs";

const COLUMNS = "id, scan_id, platform, run_at, status";

// Best upcoming TikTok and YouTube times for this video, and the times you booked in Metricool.
export const GET = handler(async (_req, ctx) => {
  const id = await paramId(ctx);
  const [suggestions, { data, error }] = await Promise.all([
    suggestionsFor(id),
    supabase().from("scheduled_posts").select(COLUMNS).eq("scan_id", id).eq("status", "booked"),
  ]);
  if (error) throw new Error(error.message);
  return json({ suggestions, bookings: (data ?? []) as Booking[] });
});

// "I scheduled it in Metricool": reserve that time so the next video's suggestion moves on. Nothing is posted.
export const POST = handler(async (req, ctx) => {
  requireGuard();
  const id = await paramId(ctx);
  const body = (await req.json().catch(() => ({}))) as { platform?: string; at?: string };
  if (!isSchedulePlatform(body.platform)) throw new HttpError("Suggested times are for TikTok and YouTube.");
  const at = new Date(String(body.at ?? ""));
  if (Number.isNaN(at.getTime())) throw new HttpError("Pick a time.");
  if (at.getTime() > Date.now() + 30 * 86_400_000) throw new HttpError("Pick a time within the next 30 days.");

  const { data, error } = await supabase()
    .from("scheduled_posts")
    .insert({ scan_id: id, platform: body.platform, run_at: at.toISOString(), status: "booked" })
    .select(COLUMNS)
    .single();
  if (error) {
    if (error.code === "23505") throw new HttpError("This video already has a time booked there. Clear it first to pick another.", 409);
    throw new Error(error.message);
  }
  return json(data);
});

// Clear this scan's booking on a platform (?platform=tiktok).
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
    .eq("status", "booked")
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new HttpError("Nothing booked to clear.", 404);
  return json({ ok: true });
});
