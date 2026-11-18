import { HttpError, json } from "@/lib/http";
import { canSubmit, submissionKind } from "@/lib/member-scan";
import { memberHandler } from "@/lib/member-routes";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

/** GET → the member's recent scans. */
export const GET = memberHandler(async (_req, member) => {
  const { data } = await supabase()
    .from("scans")
    .select("id, product_name, status, overall_score, submitted_at, review_status, submission_kind, created_at")
    .eq("creator_id", member.id)
    .order("created_at", { ascending: false })
    .limit(50);
  return json({ scans: data ?? [] });
});

/**
 * POST { kind: "scan" | "video" } → the member's open draft of that kind, or a new one.
 * Scans and videos are separate submissions. The daily limit is checked on submit (drafts cost nothing).
 */
export const POST = memberHandler(async (req, member) => {
  const body = (await req.json().catch(() => ({}))) as { kind?: unknown };
  const kind = submissionKind(body.kind);
  if (!canSubmit(kind, member.tier)) throw new HttpError("Video submissions are for invited video contributors.", 403);
  const db = supabase();
  const { data: draft } = await db
    .from("scans")
    .select("id")
    .eq("creator_id", member.id)
    .eq("submission_kind", kind)
    .eq("status", "created")
    .is("submitted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (draft) return json({ id: draft.id, kind });

  const { data, error } = await db
    .from("scans")
    .insert({ status: "created", creator_id: member.id, submission_kind: kind })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Could not start a scan: ${error?.message}`);
  return json({ id: data.id, kind });
});
