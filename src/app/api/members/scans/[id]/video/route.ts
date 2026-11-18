import { randomUUID } from "node:crypto";
import { HttpError, json, paramId } from "@/lib/http";
import { assertEditable, memberHandler, ownScan } from "@/lib/member-routes";
import { videoLengthProblem } from "@/lib/member-scan";
import { deleteMedia, objectSize, presignUpload } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { MAX_UPLOAD_BYTES, videoTypeFor } from "@/lib/uploads";

export const runtime = "nodejs";

// Step 1: { filename, contentType, size, duration } → a signed URL; the file goes straight to R2.
export const POST = memberHandler(async (req, member, ctx) => {
  const scan = await ownScan(member, await paramId(ctx));
  assertEditable(scan);
  const body = (await req.json().catch(() => ({}))) as { filename?: string; contentType?: string; size?: number; duration?: number };
  const type = videoTypeFor(body.filename ?? "", body.contentType ?? "");
  if (!type) throw new HttpError("Use an MP4, MOV or WebM video.");
  if (!(Number(body.size) > 0)) throw new HttpError("The video looks empty.");
  if (Number(body.size) > MAX_UPLOAD_BYTES) throw new HttpError(`Video is too large (max ${MAX_UPLOAD_BYTES / 1024 / 1024} MB).`, 413);
  const lengthProblem = videoLengthProblem(body.duration);
  if (lengthProblem) throw new HttpError(lengthProblem);

  const key = `scans/${scan.id}/member-video-${randomUUID()}.${type.ext}`;
  return json({ key, contentType: type.type, uploadUrl: await presignUpload("videos", key, type.type) });
});

// Step 2: { key, duration } after the upload → the video joins the scan, replacing an earlier one.
export const PUT = memberHandler(async (req, member, ctx) => {
  const scan = await ownScan(member, await paramId(ctx));
  assertEditable(scan);
  const { key, duration } = (await req.json().catch(() => ({}))) as { key?: string; duration?: number };
  if (typeof key !== "string" || !key.startsWith(`scans/${scan.id}/member-video-`) || key.includes("..")) throw new HttpError("Bad upload key.");
  const lengthProblem = videoLengthProblem(duration);
  if (lengthProblem) throw new HttpError(lengthProblem);
  const size = await objectSize("videos", key);
  if (size === null) throw new HttpError("The upload didn’t arrive. Try again.");
  if (size > MAX_UPLOAD_BYTES) {
    await deleteMedia("videos", key).catch(() => {});
    throw new HttpError("Video is too large.", 413);
  }

  const db = supabase();
  const { data: old } = await db.from("scan_media").select("id, storage_path").eq("scan_id", scan.id).eq("kind", "product_video");
  const { error } = await db
    .from("scan_media")
    .insert({ scan_id: scan.id, kind: "product_video", storage_path: key, sort_order: 0, duration_s: Number(duration) });
  if (error) throw new Error(error.message);
  const stale = (old ?? []).filter((r) => r.storage_path !== key);
  if (stale.length) {
    await db.from("scan_media").delete().in("id", stale.map((r) => r.id));
    await Promise.allSettled(stale.map((r) => deleteMedia("videos", r.storage_path)));
  }
  return json({ ok: true });
});
