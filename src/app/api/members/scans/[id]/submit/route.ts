import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { analyzeScan } from "@/lib/analyze-scan";
import { HttpError, json, paramId } from "@/lib/http";
import { memberHandler, ownScan, type OwnScan } from "@/lib/member-routes";
import { PART_LABELS, dailySubmitLimit, missingParts, nextSubmitAt, normalizeProductName, waitText } from "@/lib/member-scan";
import { copyMedia } from "@/lib/storage";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

type Db = ReturnType<typeof supabase>;

/** Throws 429 if the member used up today's submissions of this kind (scans and videos count separately). */
async function checkDailyLimit(db: Db, memberId: string, scan: OwnScan) {
  const { data: recent } = await db
    .from("scans")
    .select("submitted_at")
    .eq("creator_id", memberId)
    .eq("submission_kind", scan.kind)
    .neq("id", scan.id)
    .gte("submitted_at", new Date(Date.now() - 86_400_000).toISOString());
  const limit = dailySubmitLimit();
  const until = nextSubmitAt((recent ?? []).map((r) => Date.parse(r.submitted_at as string)), limit);
  if (until) {
    const noun = scan.kind === "video" ? "video" : "scan";
    const what = limit === 1 ? `one ${noun}` : `${limit} ${noun}s`;
    throw new HttpError(`You can submit ${what} every 24 hours. Your next one opens ${waitText(until)}. Your draft is saved.`, 429);
  }
}

/**
 * The member's video becomes an uploaded clip on the scan, so it's ready in the admin's video
 * studio (uploaded clips are the footage of the final render). Its own copy, so removing the
 * clip there never breaks the original the reviewer watches.
 */
async function addVideoAsClip(db: Db, scanId: string) {
  const { data: existing } = await db
    .from("scan_media")
    .select("id")
    .eq("scan_id", scanId)
    .eq("kind", "clip")
    .like("storage_path", `scans/${scanId}/upload-member-%`)
    .limit(1)
    .maybeSingle();
  if (existing) return;
  const { data: video } = await db.from("scan_media").select("storage_path").eq("scan_id", scanId).eq("kind", "product_video").maybeSingle();
  if (!video) throw new HttpError("Add your video first.");
  const ext = (video.storage_path as string).split(".").pop() ?? "mp4";
  const key = `scans/${scanId}/upload-member-${randomUUID()}.${ext}`;
  await copyMedia("videos", video.storage_path as string, key);
  const { error } = await db.from("scan_media").insert({ scan_id: scanId, kind: "clip", storage_path: key, sort_order: 0 });
  if (error) throw new Error(`Could not save the clip: ${error.message}`);
}

/**
 * POST → submits the draft.
 *   scan:  needs the label + product photo; reads the label and scores it. Points land when analyzed.
 *   video: { product_name } + product photo + video; waits for the admin's review (no AI read).
 */
export const POST = memberHandler(async (req, member, ctx) => {
  const scan = await ownScan(member, await paramId(ctx));
  if (scan.kind === "scan" && scan.status === "analyzed") return json({ id: scan.id });
  if (scan.kind === "video" && scan.submitted_at) return json({ id: scan.id });
  if (scan.status === "analyzing") throw new HttpError("Still reading your label. Give it a moment.", 409);

  const db = supabase();
  const { data: media } = await db.from("scan_media").select("kind").eq("scan_id", scan.id);
  const missing = missingParts((media ?? []).map((m) => m.kind as string), scan.kind);
  if (missing.length) throw new HttpError(`Add your ${missing.map((m) => PART_LABELS[m].toLowerCase()).join(", ")} first.`);

  if (scan.kind === "video") {
    const body = (await req.json().catch(() => ({}))) as { product_name?: unknown };
    const name = normalizeProductName(body.product_name);
    if (!name) throw new HttpError("Type the product’s name (2–80 characters).");
    await checkDailyLimit(db, member.id, scan);
    await addVideoAsClip(db, scan.id);
    const { error } = await db
      .from("scans")
      .update({ product_name: name, submitted_at: new Date().toISOString(), review_status: "pending" })
      .eq("id", scan.id);
    if (error) throw new Error(error.message);
    return json({ id: scan.id });
  }

  if (!scan.submitted_at) {
    await checkDailyLimit(db, member.id, scan);
    await db.from("scans").update({ submitted_at: new Date().toISOString(), review_status: "pending" }).eq("id", scan.id);
  }
  const res = await analyzeScan(scan.id);
  if (!res.ok) {
    // A failed read (blurry label) can be retried with a new photo: reopen the draft.
    await db.from("scans").update({ submitted_at: null, review_status: null, status: "created" }).eq("id", scan.id);
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return NextResponse.json({ error: body.error ?? "Couldn’t read that label." }, { status: res.status });
  }
  return json({ id: scan.id });
});
