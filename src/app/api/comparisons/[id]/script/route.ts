import { supabase } from "@/lib/supabase";
import { HttpError, handler, json, paramId } from "@/lib/http";
import { getComparison, loadCompareProducts } from "@/lib/comparisons";
import { createCompareScript } from "@/lib/compare-script";
import { parseTone } from "@/lib/script";

export const runtime = "nodejs";
// A 3-minute script for up to four products is a long answer; one retry may follow.
export const maxDuration = 180;

// Writes (or rewrites) the comparison script and verdict. `winner` (1-based) fixes the winner; 0/null lets the AI pick.
export const POST = handler(async (req, ctx) => {
  const id = await paramId(ctx);
  const body = (await req.json().catch(() => ({}))) as { tone?: unknown; winner?: unknown };
  const db = supabase();
  const cmp = await getComparison(db, id);
  if (!cmp) throw new HttpError("Not found.", 404);

  const w = Math.round(Number(body.winner));
  const forced = Number.isInteger(w) && w >= 1 && w <= cmp.scan_ids.length ? w : null;
  let products;
  try {
    products = await loadCompareProducts(db, cmp.scan_ids);
  } catch (e) {
    throw new HttpError(e instanceof Error ? e.message : "A product is missing.");
  }

  const { data: job } = await db.from("jobs").insert({ comparison_id: id, step: "script", status: "running" }).select("id").single();
  try {
    const script = await createCompareScript(products, { tone: parseTone(body.tone), forcedWinner: forced });
    const { error } = await db
      .from("comparisons")
      .update({
        script: JSON.stringify(script),
        title: script.title,
        forced_winner: forced,
        // A new script makes the old voice and video stale.
        audio_path: null,
        duration_s: null,
        words: null,
        alignment: null,
        video_path: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw new Error(`Saving the script failed: ${error.message}`);
    if (job) await db.from("jobs").update({ status: "done" }).eq("id", job.id);
    return json({ script });
  } catch (err) {
    if (job) await db.from("jobs").update({ status: "failed", error: err instanceof Error ? err.message : "Script failed." }).eq("id", job.id);
    throw err;
  }
});
