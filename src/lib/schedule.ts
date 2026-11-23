import { supabase } from "@/lib/supabase";
import { SCHEDULE_PLATFORMS, suggestSlots, type SchedulePlatform, type Suggestion } from "@/lib/post-schedule";

// Bookings are times you scheduled in Metricool. The app never posts them; they only reserve the slot.
export type Booking = {
  id: string;
  scan_id: string;
  platform: SchedulePlatform;
  run_at: string;
  status: "booked" | "canceled";
};

/** Times already used on a platform: bookings (any scan) plus anything posted from the app in the last day. */
export async function takenTimes(platform: SchedulePlatform, exceptScanId?: string): Promise<Date[]> {
  const db = supabase();
  const { data: booked, error } = await db
    .from("scheduled_posts")
    .select("run_at, scan_id")
    .eq("platform", platform)
    .eq("status", "booked")
    .gte("run_at", new Date(Date.now() - 2 * 86_400_000).toISOString());
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
