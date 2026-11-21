import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createScript, offFactsLine, parseScript, parseTone, type VideoScript } from "@/lib/script";
import { applyEdits } from "@/lib/script-edit";
import { HttpError, handler, json, paramId } from "@/lib/http";
import { latestVideo } from "@/lib/queries";
import { candidatesFor, sameProduct, type Target } from "@/lib/targets";
import { getMedia } from "@/lib/storage";
import type { LlmImage } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { tone?: unknown };
  const tone = parseTone(body.tone);
  const db = supabase();

  const { data: scan } = await db
    .from("scans")
    .select("id, product_name, status, overall_score, allergens, off_data")
    .eq("id", id)
    .maybeSingle();
  if (!scan || scan.status !== "analyzed" || scan.overall_score === null) {
    return NextResponse.json({ error: "Scan not found or not analyzed yet." }, { status: 404 });
  }

  const { data: ings } = await db
    .from("scan_ingredients")
    .select("raw_name, score, reason")
    .eq("scan_id", id)
    .order("position");

  // Product photos, so the script describes what the product really looks like.
  const { data: photoRows } = await db
    .from("scan_media")
    .select("storage_path")
    .eq("scan_id", id)
    .eq("kind", "product_image")
    .order("sort_order")
    .limit(4);
  const photos: LlmImage[] = [];
  for (const row of photoRows ?? []) {
    try {
      const path = row.storage_path as string;
      const mediaType = path.endsWith(".png") ? "image/png" : path.endsWith(".webp") ? "image/webp" : "image/jpeg";
      photos.push({ data: await getMedia("images", path), mediaType });
    } catch {
      // a missing photo shouldn't block the script
    }
  }

  // Recent scans, so "tomorrow's scan" builds a series and never repeats one.
  const { data: recentRows } = await db
    .from("scans")
    .select("product_name, overall_score")
    .eq("status", "analyzed")
    .not("product_name", "is", null)
    .neq("id", id)
    .order("created_at", { ascending: false })
    .limit(15);
  const recentScans = (recentRows ?? [])
    .filter((r) => r.overall_score !== null)
    .map((r) => ({ name: r.product_name as string, score: r.overall_score as number }));

  // The products-to-scan list: tick this product off, and offer its rivals as tomorrow's scan.
  const { data: targetRows } = await db
    .from("scan_targets")
    .select("id, product, store, category, compare_group, priority, status, scan_id")
    .limit(1000);
  const targets = (targetRows ?? []) as Target[];
  const name = (scan.product_name as string | null) ?? "";
  const current = name ? (targets.find((t) => t.scan_id === id) ?? targets.find((t) => t.status !== "scanned" && sameProduct(name, t.product)) ?? null) : null;
  if (current && current.status !== "scanned") {
    await db.from("scan_targets").update({ status: "scanned", scan_id: id, updated_at: new Date().toISOString() }).eq("id", current.id);
  }
  const candidates = candidatesFor(targets, current);

  const { data: job } = await db
    .from("jobs")
    .insert({ scan_id: id, step: "script", status: "running" })
    .select("id")
    .single();

  try {
    const script = await createScript({
      productName: scan.product_name,
      overall: scan.overall_score,
      allergens: scan.allergens ?? [],
      offFacts: offFactsLine(scan.off_data),
      photos,
      tone,
      recentScans,
      targets: candidates,
      ingredients: (ings ?? []).map((i) => ({ name: i.raw_name, score: i.score, reason: i.reason })),
    });

    // "T3" from the model → the list item's id, and that product becomes "Wanted next" for members.
    if (script.next?.targetId) {
      const pick = candidates.find((c) => c.ref === script.next?.targetId);
      if (pick) {
        script.next = { ...script.next, targetId: pick.id, product: pick.product, store: pick.store };
        if (pick.status === "todo") {
          await db.from("scan_targets").update({ status: "next", updated_at: new Date().toISOString() }).eq("id", pick.id);
        }
      } else {
        delete script.next.targetId;
      }
    }
    await saveVersion(db, id, script);

    if (job) await db.from("jobs").update({ status: "done" }).eq("id", job.id);
    return NextResponse.json({ script });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Script generation failed.";
    if (job) await db.from("jobs").update({ status: "failed", error: message }).eq("id", job.id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Saves a script as the scan's newest version (earlier voice takes then show as "Earlier script"). */
async function saveVersion(db: ReturnType<typeof supabase>, scanId: string, script: VideoScript) {
  const { data: last } = await db
    .from("videos")
    .select("version")
    .eq("scan_id", scanId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await db
    .from("videos")
    .insert({ scan_id: scanId, script: JSON.stringify(script), version: (last?.version ?? 0) + 1 });
  if (error) throw new Error(`Saving script failed: ${error.message}`);
}

// Saves your hand edits (changed, added or removed lines) without asking the AI for a new script.
export const PUT = handler(async (req, ctx) => {
  const id = await paramId(ctx);
  const body = (await req.json().catch(() => ({}))) as { script?: unknown };
  const db = supabase();
  const video = await latestVideo(db, id);
  if (!video?.script) throw new HttpError("Create the script first.");
  let previous: VideoScript;
  try {
    previous = parseScript(video.script);
  } catch {
    throw new HttpError("The saved script can't be read. Rewrite it first.");
  }
  let script: VideoScript;
  try {
    script = applyEdits(previous, body.script);
  } catch (err) {
    throw new HttpError(err instanceof Error ? err.message : "Bad script.");
  }
  if (JSON.stringify(script) === JSON.stringify(previous)) return json({ script, unchanged: true });
  await saveVersion(db, id, script);
  return json({ script });
});
