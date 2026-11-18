import { HttpError, handler, json, paramId } from "@/lib/http";
import { acceptedMessage, submissionKind } from "@/lib/member-scan";
import { supabase } from "@/lib/supabase";

// Admin only (behind the admin login): review a member's scan or video submission.
// { status: "approved" | "rejected", public?: boolean }. Rejecting takes the scan's points back (0017).
// Approving leaves the member an "accepted" notice on their rewards page (once per submission).
export const POST = handler(async (req, ctx) => {
  const id = await paramId(ctx);
  const body = (await req.json().catch(() => ({}))) as { status?: unknown; public?: unknown };
  if (body.status !== "approved" && body.status !== "rejected") throw new HttpError("status must be approved or rejected.");
  const update: { review_status: string; is_public?: boolean } = { review_status: body.status };
  if (body.status === "rejected") update.is_public = false;
  else if (typeof body.public === "boolean") update.is_public = body.public;

  const db = supabase();
  const { data, error } = await db
    .from("scans")
    .update(update)
    .eq("id", id)
    .not("creator_id", "is", null)
    .select("id, creator_id, product_name, submission_kind")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new HttpError("Member submission not found.", 404);

  if (body.status === "approved") {
    const { error: noteError } = await db.from("member_notifications").upsert(
      {
        creator_id: data.creator_id,
        scan_id: data.id,
        kind: "accepted",
        message: acceptedMessage(submissionKind(data.submission_kind), data.product_name),
      },
      { onConflict: "scan_id,kind", ignoreDuplicates: true },
    );
    // The review itself is saved; a missing notice shouldn't undo it.
    if (noteError) console.error(`Accepted notice for ${id} failed: ${noteError.message}`);
  }
  return json({ ok: true, ...update });
});
