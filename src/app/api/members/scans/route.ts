import { json } from "@/lib/http";
import { memberHandler } from "@/lib/member-routes";
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

/** POST → the member's open draft, or a new one. The daily limit is checked on submit (drafts cost nothing). */
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

  const { data, error } = await db.from("scans").insert({ status: "created", creator_id: member.id }).select("id").single();
  if (error || !data) throw new Error(`Could not start a scan: ${error?.message}`);
  return json({ id: data.id });
});
