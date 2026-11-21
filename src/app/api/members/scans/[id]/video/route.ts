import { randomUUID } from "node:crypto";
import { HttpError, json, paramId } from "@/lib/http";
import { assertEditable, assertPart, memberHandler, ownScan } from "@/lib/member-routes";
import { MAX_MEMBER_VIDEOS, clipLengthProblem } from "@/lib/member-scan";
import { deleteMedia, objectSize, presignUpload } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { MAX_UPLOAD_BYTES, videoTypeFor } from "@/lib/uploads";

export const runtime = "nodejs";

// A video submission holds up to MAX_MEMBER_VIDEOS clips (recorded in the app or picked from the
// phone). Each clip is 3-75 s; together they must be about a minute (checked on submit).

async function clips(scanId: string) {
  const { data } = await supabase()
    .from("scan_media")
    .select("id, storage_path, sort_order")
    .eq("scan_id", scanId)
    .eq("kind", "product_video")
    .order("sort_order");
  return data ?? [];
}

const full = () => new HttpError(`You already have ${MAX_MEMBER_VIDEOS} clips. Remove one to add another.`, 409);

// Step 1: { filename, contentType, size, duration } → a signed URL; the file goes straight to R2.
export const POST = memberHandler(async (req, member, ctx) => {
  const scan = await ownScan(member, await paramId(ctx));
  assertEditable(scan);
  assertPart(scan, "product_video");
  const body = (await req.json().catch(() => ({}))) as { filename?: string; contentType?: string; size?: number; duration?: number };
  const type = videoTypeFor(body.filename ?? "", body.contentType ?? "");
  if (!type) throw new HttpError("Use an MP4, MOV or WebM video.");
  if (!(Number(body.size) > 0)) throw new HttpError("The video looks empty.");
  if (Number(body.size) > MAX_UPLOAD_BYTES) throw new HttpError(`Video is too large (max ${MAX_UPLOAD_BYTES / 1024 / 1024} MB).`, 413);
  const lengthProblem = clipLengthProblem(body.duration);
  if (lengthProblem) throw new HttpError(lengthProblem);
  if ((await clips(scan.id)).length >= MAX_MEMBER_VIDEOS) throw full();

  const key = `scans/${scan.id}/member-video-${randomUUID()}.${type.ext}`;
  return json({ key, contentType: type.type, uploadUrl: await presignUpload("videos", key, type.type) });
});

// Step 2: { key, duration } after the upload → the clip is added after the others.
export const PUT = memberHandler(async (req, member, ctx) => {
  const scan = await ownScan(member, await paramId(ctx));
  assertEditable(scan);
  assertPart(scan, "product_video");
  const { key, duration } = (await req.json().catch(() => ({}))) as { key?: string; duration?: number };
  if (typeof key !== "string" || !key.startsWith(`scans/${scan.id}/member-video-`) || key.includes("..")) throw new HttpError("Bad upload key.");
  const lengthProblem = clipLengthProblem(duration);
  if (lengthProblem) throw new HttpError(lengthProblem);
  const size = await objectSize("videos", key);
  if (size === null) throw new HttpError("The upload didn’t arrive. Try again.");
  if (size > MAX_UPLOAD_BYTES) {
    await deleteMedia("videos", key).catch(() => {});
    throw new HttpError("Video is too large.", 413);
  }

  const have = await clips(scan.id);
  if (have.some((c) => c.storage_path === key)) return json({ ok: true });
  if (have.length >= MAX_MEMBER_VIDEOS) {
    await deleteMedia("videos", key).catch(() => {});
    throw full();
  }
  const next = have.reduce((n, c) => Math.max(n, (c.sort_order as number) ?? 0), -1) + 1;
  const { error } = await supabase()
    .from("scan_media")
    .insert({ scan_id: scan.id, kind: "product_video", storage_path: key, sort_order: next, duration_s: Number(duration) });
  if (error) throw new Error(error.message);
  return json({ ok: true });
});

// { media_id } → removes one clip before the submission is sent.
export const DELETE = memberHandler(async (req, member, ctx) => {
  const scan = await ownScan(member, await paramId(ctx));
  assertEditable(scan);
  const { media_id } = (await req.json().catch(() => ({}))) as { media_id?: string };
  const clip = (await clips(scan.id)).find((c) => c.id === media_id);
  if (!clip) throw new HttpError("Clip not found.", 404);
  await supabase().from("scan_media").delete().eq("id", clip.id);
  await deleteMedia("videos", clip.storage_path as string).catch(() => {});
  return json({ ok: true });
});
