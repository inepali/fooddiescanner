import { json, paramId } from "@/lib/http";
import { assertEditable, memberHandler, ownScan } from "@/lib/member-routes";
import { missingParts, partsFor } from "@/lib/member-scan";
import { deleteMedia, mediaUrl } from "@/lib/storage";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

/** GET → what's uploaded so far, and the result once it's analyzed. */
export const GET = memberHandler(async (_req, member, ctx) => {
  const scan = await ownScan(member, await paramId(ctx));
  const db = supabase();
  const { data: media } = await db
    .from("scan_media")
    .select("kind, storage_path, duration_s")
    .eq("scan_id", scan.id)
    .in("kind", ["label", "product_image", "product_video"]);
  const rows = media ?? [];
  const photos = await Promise.all(
    rows.filter((m) => m.kind !== "product_video").map(async (m) => ({ kind: m.kind, url: await mediaUrl("images", m.storage_path, 900) })),
  );
  const video = rows.find((m) => m.kind === "product_video");

  let ingredients: { name: string; score: number | null; band: string | null; reason: string | null }[] = [];
  if (scan.status === "analyzed") {
    const { data: ings } = await db.from("scan_ingredients").select("raw_name, score, band, reason").eq("scan_id", scan.id).order("position");
    ingredients = (ings ?? []).map((i) => ({ name: i.raw_name, score: i.score, band: i.band, reason: i.reason }));
  }
  return json({
    scan,
    photos,
    video: video ? { duration_s: video.duration_s } : null,
    parts: partsFor(scan.kind),
    missing: missingParts(rows.map((m) => m.kind as string), scan.kind, { barcode: Boolean(scan.off_code) }),
    ingredients,
  });
});

/** DELETE → throw away an unsubmitted draft and its files. */
export const DELETE = memberHandler(async (_req, member, ctx) => {
  const scan = await ownScan(member, await paramId(ctx));
  assertEditable(scan);
  const db = supabase();
  const { data: media } = await db.from("scan_media").select("kind, storage_path").eq("scan_id", scan.id);
  await Promise.allSettled(
    (media ?? []).map((m) => deleteMedia(m.kind === "product_video" || m.kind === "clip" ? "videos" : "images", m.storage_path)),
  );
  await db.from("scans").delete().eq("id", scan.id);
  return json({ ok: true });
});
