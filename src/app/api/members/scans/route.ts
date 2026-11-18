import { HttpError, json } from "@/lib/http";
import { memberHandler } from "@/lib/member-routes";
import { dailyScanLimit } from "@/lib/member-scan";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

/** GET → the member's recent scans. */
export const GET = memberHandler(async (_req, member) => {
  const { data } = await supabase()
    .from("scans")
    .select("id, product_name, status, overall_score, submitted_at, review_status, created_at")
    .eq("creator_id", member.id)
    .order("created_at", { ascending: false })
    .limit(50);
  return json({ scans: data ?? [] });
});

/** POST → a new draft scan, within the daily limit. Reuses an unfinished draft first. */
export const POST = memberHandler(async (_req, member) => {
  const db = supabase();
  const { data: draft } = await db
    .from("scans")
    .select("id")
    .eq("creator_id", member.id)
    .eq("status", "created")
    .is("submitted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (draft) return json({ id: draft.id });

  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await db
    .from("scans")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", member.id)
    .gte("created_at", since);
  const limit = dailyScanLimit();
  if ((count ?? 0) >= limit) throw new HttpError(`You’ve reached today’s limit of ${limit} scans. Come back tomorrow!`, 429);

  const { data, error } = await db.from("scans").insert({ status: "created", creator_id: member.id }).select("id").single();
  if (error || !data) throw new Error(`Could not start a scan: ${error?.message}`);
  return json({ id: data.id });
});
