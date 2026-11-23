import { supabase } from "@/lib/supabase";
import { SCHEDULE_PLATFORMS, suggestSlots, type SchedulePlatform, type Suggestion } from "@/lib/post-schedule";

export type Booking = {
  id: string;
  scan_id: string;
  platform: SchedulePlatform;
  run_at: string;
  via: "app" | "metricool";
  status: "scheduled" | "posting" | "posted" | "failed" | "missed" | "canceled" | "external";
  privacy: string | null;
  error: string | null;
  social_post_id: string | null;
};

export const LIVE_STATUSES = ["scheduled", "posting", "external"] as const;

/** Times already used on a platform: live bookings (any scan) plus anything posted in the last day. */
export async function takenTimes(platform: SchedulePlatform, exceptScanId?: string): Promise<Date[]> {
  const db = supabase();
  let q = db.from("scheduled_posts").select("run_at, scan_id").eq("platform", platform).in("status", [...LIVE_STATUSES, "posted"]);
  q = q.gte("run_at", new Date(Date.now() - 2 * 86_400_000).toISOString());
  const { data: booked, error } = await q;
  if (error) throw new Error(error.message);
  const { data: posted } = await db
    .from("social_posts")
    .select("created_at")
    .eq("platform", platform)
    .neq("status", "failed")
    .gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
  return [
    ...(booked ?? []).filter((b) => b.scan_id !== exceptScanId).map((b) => new Date(b.run_at as string)),
    ...(posted ?? []).map((p) => new Date(p.created_at as string)),
  ];
}

export async function suggestionsFor(scanId: string): Promise<Record<SchedulePlatform, Suggestion[]>> {
  const out = {} as Record<SchedulePlatform, Suggestion[]>;
  for (const p of SCHEDULE_PLATFORMS) out[p] = suggestSlots(p, new Date(), await takenTimes(p, scanId));
  return out;
}
