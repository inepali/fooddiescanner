import { HttpError, handler, json, paramId } from "@/lib/http";
import { supabase } from "@/lib/supabase";

// Admin only (behind APP_PASSWORD): review a member's submission.
// { status: "approved" | "rejected", public?: boolean }. Rejecting takes the scan's points back (0017).
export const POST = handler(async (req, ctx) => {
  const id = await paramId(ctx);
  const body = (await req.json().catch(() => ({}))) as { status?: unknown; public?: unknown };
  if (body.status !== "approved" && body.status !== "rejected") throw new HttpError("status must be approved or rejected.");
  const update: { review_status: string; is_public?: boolean } = { review_status: body.status };
  if (body.status === "rejected") update.is_public = false;
  else if (typeof body.public === "boolean") update.is_public = body.public;
  const { data, error } = await supabase().from("scans").update(update).eq("id", id).not("creator_id", "is", null).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new HttpError("Member submission not found.", 404);
  return json({ ok: true, ...update });
});
