import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { HttpError, handler, json, paramId } from "@/lib/http";
import { deleteMedia, putMedia } from "@/lib/storage";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
// Vercel serverless requests are capped near 4.5 MB; the browser downsizes photos first.
const MAX_BYTES = 4 * 1024 * 1024;

/**
 * Admin only (behind the admin login): add or replace the photo on a scan's card, analyzed or not.
 * The card shows the first product photo, so the new one goes first; if it replaces a product
 * photo, the old one is deleted. A label photo is never replaced here (it's the ingredient source).
 * POST multipart { file }.
 */
export const POST = handler(async (req, ctx) => {
  const id = await paramId(ctx);
  const db = supabase();
  const { data: scan } = await db.from("scans").select("id").eq("id", id).maybeSingle();
  if (!scan) throw new HttpError("Scan not found.", 404);

  const file = (await req.formData()).get("file");
  if (!(file instanceof File) || file.size === 0) throw new HttpError("A photo is required.");
  if (!ALLOWED_TYPES.includes(file.type)) throw new HttpError("Use a JPEG, PNG or WebP photo.");
  if (file.size > MAX_BYTES) throw new HttpError("Photo is too large (max 4 MB).", 413);

  const { data: photos } = await db
    .from("scan_media")
    .select("id, storage_path, sort_order")
    .eq("scan_id", id)
    .eq("kind", "product_image")
    .order("sort_order")
    .limit(1);
  const current = photos?.[0];

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const key = `scans/${id}/product_image-${randomUUID()}.${ext}`;
  await putMedia("images", key, Buffer.from(await file.arrayBuffer()), file.type);
  const { error } = await db
    .from("scan_media")
    .insert({ scan_id: id, kind: "product_image", storage_path: key, sort_order: current ? current.sort_order : 0 });
  if (error) {
    await deleteMedia("images", key).catch(() => {});
    throw new Error(`Saving photo failed: ${error.message}`);
  }
  if (current) {
    await db.from("scan_media").delete().eq("id", current.id);
    await deleteMedia("images", current.storage_path).catch(() => {});
  }

  revalidatePath(`/p/${id}`);
  revalidatePath("/");
  revalidatePath("/search");
  return json({ ok: true, replaced: Boolean(current) });
});
