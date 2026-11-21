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
    .select("id, kind, storage_path, duration_s, sort_order")
    .eq("scan_id", scan.id)
    .in("kind", ["label", "product_image", "product_video"])
    .order("sort_order");
  const rows = media ?? [];
  const photos = await Promise.all(
    rows.filter((m) => m.kind !== "product_video").map(async (m) => ({ kind: m.kind, url: await mediaUrl("images", m.storage_path, 900) })),
  );
  const clips = rows.filter((m) => m.kind === "product_video");
  const videos = await Promise.all(
    clips.map(async (m) => ({ id: m.id as string, duration_s: m.duration_s as number | null, url: await mediaUrl("videos", m.storage_path, 900) })),
  );

  // Same breakdown the admin sees: every ingredient, the overall ring, allergens, Open Food Facts.
  let result: {
    ingredients: { id: string; position: number; raw_name: string; score: number; band: string; reason: string | null; provisional: boolean }[];
    allergens: string[];
    label_score: number | null;
    external_score: number | null;
    off: unknown;
  } | null = null;
  if (scan.status === "analyzed") {
    const [{ data: ings }, { data: extra }] = await Promise.all([
      db.from("scan_ingredients").select("id, position, raw_name, score, band, reason, provisional").eq("scan_id", scan.id).order("position"),
      db.from("scans").select("allergens, label_score, external_score, off_data").eq("id", scan.id).maybeSingle(),
    ]);
    result = {
      ingredients: ings ?? [],
      allergens: (extra?.allergens as string[] | null) ?? [],
      label_score: extra?.label_score ?? null,
      external_score: extra?.external_score ?? null,
      off: extra?.off_data ?? null,
    };
  }
  return json({
    scan,
    photos,
    videos,
    video: videos.length ? { duration_s: videos.reduce((n, v) => n + (Number(v.duration_s) || 0), 0) } : null,
    parts: partsFor(scan.kind),
    missing: missingParts(rows.map((m) => m.kind as string), scan.kind, { barcode: Boolean(scan.off_code) }),
    result,
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
