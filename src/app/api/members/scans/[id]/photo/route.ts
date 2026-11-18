import { randomUUID } from "node:crypto";
import { HttpError, json, paramId } from "@/lib/http";
import { assertEditable, assertPart, memberHandler, ownScan } from "@/lib/member-routes";
import { deleteMedia, putMedia } from "@/lib/storage";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 4 * 1024 * 1024; // the browser downsizes first; Vercel caps bodies near 4.5 MB

/** POST form { kind: "label" | "product_image", file } → one of each per scan; a new one replaces the old. */
export const POST = memberHandler(async (req, member, ctx) => {
  const scan = await ownScan(member, await paramId(ctx));
  assertEditable(scan);
  const form = await req.formData();
  const kind = form.get("kind");
  const file = form.get("file");
  if (kind !== "label" && kind !== "product_image") throw new HttpError("Unknown photo kind.");
  assertPart(scan, kind);
  if (!(file instanceof File) || file.size === 0) throw new HttpError("A photo is required.");
  if (!TYPES.includes(file.type)) throw new HttpError("Use a JPEG, PNG or WebP photo.");
  if (file.size > MAX_BYTES) throw new HttpError("Photo is too large (max 4 MB).", 413);

  const db = supabase();
  const { data: old } = await db.from("scan_media").select("id, storage_path").eq("scan_id", scan.id).eq("kind", kind);
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const key = `scans/${scan.id}/${kind}-${randomUUID()}.${ext}`;
  await putMedia("images", key, Buffer.from(await file.arrayBuffer()), file.type);
  const { error } = await db.from("scan_media").insert({ scan_id: scan.id, kind, storage_path: key, sort_order: 0 });
  if (error) throw new Error(`Saving photo failed: ${error.message}`);
  if (old?.length) {
    await db.from("scan_media").delete().in("id", old.map((r) => r.id));
    await Promise.allSettled(old.map((r) => deleteMedia("images", r.storage_path)));
  }
  return json({ ok: true });
});
