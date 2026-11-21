import { supabase } from "@/lib/supabase";
import { latestVideo } from "@/lib/queries";
import { parseScript, type VideoScript } from "@/lib/script";
import { applyEdits, refineScript } from "@/lib/script-edit";
import { HttpError, handler, json, paramId } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;

// Lets the AI polish your edited lines (one line, or the whole script lightly). Nothing is saved:
// the result goes back into the editor so you can tweak it and press Save.
export const POST = handler(async (req, ctx) => {
  const id = await paramId(ctx);
  const body = (await req.json().catch(() => ({}))) as { script?: unknown; scene?: unknown; instruction?: unknown };
  const db = supabase();

  const video = await latestVideo(db, id);
  if (!video?.script) throw new HttpError("Create the script first.");
  let saved: VideoScript;
  try {
    saved = parseScript(video.script);
  } catch {
    throw new HttpError("The saved script can't be read. Rewrite it first.");
  }
  // Work on what is in the editor right now (unsaved edits included).
  let draft: VideoScript;
  try {
    draft = body.script ? applyEdits(saved, body.script) : saved;
  } catch (err) {
    throw new HttpError(err instanceof Error ? err.message : "Bad script.");
  }

  const { data: scan } = await db.from("scans").select("product_name").eq("id", id).maybeSingle();
  const { data: ings } = await db.from("scan_ingredients").select("raw_name").eq("scan_id", id).order("position");

  const scene = Number.isInteger(body.scene) ? (body.scene as number) : undefined;
  const instruction = typeof body.instruction === "string" ? body.instruction.trim() : "";
  const script = await refineScript({
    script: draft,
    scene,
    instruction: instruction || undefined,
    productName: (scan?.product_name as string | null) ?? null,
    ingredients: (ings ?? []).map((i) => i.raw_name as string),
  });
  return json({ script });
});
