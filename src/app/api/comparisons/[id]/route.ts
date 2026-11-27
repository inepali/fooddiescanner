import { supabase } from "@/lib/supabase";
import { HttpError, handler, json, paramId } from "@/lib/http";
import { getComparison } from "@/lib/comparisons";
import { parseCompareScript } from "@/lib/compare-script";
import { deleteMedia } from "@/lib/storage";

export const runtime = "nodejs";

// Hand edits: voiceover lines (by scene index) and the title. Changing what is spoken makes the voice and video stale.
export const PATCH = handler(async (req, ctx) => {
  const id = await paramId(ctx);
  const body = (await req.json().catch(() => ({}))) as { lines?: unknown; title?: unknown };
  const db = supabase();
  const cmp = await getComparison(db, id);
  if (!cmp) throw new HttpError("Not found.", 404);

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.title === "string" && body.title.trim()) update.title = body.title.trim().slice(0, 100);

  if (Array.isArray(body.lines)) {
    if (!cmp.script) throw new HttpError("Create the script first.");
    const script = parseCompareScript(cmp.script, cmp.scan_ids.length);
    let changed = false;
    body.lines.forEach((line, i) => {
      const scene = script.scenes[i];
      if (!scene || typeof line !== "string") return;
      const text = line.trim().slice(0, 1000);
      if (text && text !== scene.voiceover) {
        scene.voiceover = text;
        scene.edited = true;
        changed = true;
      }
    });
    if (changed) {
      update.script = JSON.stringify(script);
      Object.assign(update, { audio_path: null, duration_s: null, words: null, alignment: null, video_path: null });
    }
  }
  const { error } = await db.from("comparisons").update(update).eq("id", id);
  if (error) throw new Error(`Saving failed: ${error.message}`);
  return json({ ok: true });
});

export const DELETE = handler(async (_req, ctx) => {
  const id = await paramId(ctx);
  const db = supabase();
  const cmp = await getComparison(db, id);
  if (!cmp) return json({ ok: true });
  await Promise.all(
    [cmp.audio_path, cmp.video_path].filter((p): p is string => !!p).map((p) => deleteMedia("videos", p).catch(() => {})),
  );
  await db.from("comparisons").delete().eq("id", id);
  return json({ ok: true });
});
