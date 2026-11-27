import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { supabase } from "./supabase";
import { getMedia, putMedia } from "./storage";
import { parseCompareScript } from "./compare-script";
import { buildAss } from "./captions";
import { planCompare, type FootageSource } from "./compare-timeline";
import { buildFfmpegArgs, probeDuration, runFfmpeg, type RenderProgress, type RenderSegment } from "./render";

// Renders a comparison video (1080x1920) from its script, voiceover and the products'
// own footage. Same job/heartbeat/cancel contract as render-job.ts, so the browser
// polls /api/jobs/[id] the same way, and the render worker can run it too.

const FONT_NAME = "DejaVu Sans";
/** Videos downloaded per product (keeps the worker's in-memory /tmp in check). */
const CLIPS_PER_PRODUCT = Number(process.env.COMPARE_CLIPS_PER_PRODUCT ?? 3);
const PHOTOS_PER_PRODUCT = 3;

class Cancelled extends Error {}

type Row = { id: string; scan_id: string; kind: string; storage_path: string; sort_order: number; source_media_id: string | null };

/** "1  Granola Bites · 72" in a dark box at the top, for whichever product is on screen. */
export function productChips(
  segments: { start: number; end: number; shown: number }[],
  names: string[],
  scores: (number | null)[],
): string[] {
  const t = (s: number) => {
    const cs = Math.max(0, Math.round(s * 100));
    return `${Math.floor(cs / 360000)}:${String(Math.floor((cs % 360000) / 6000)).padStart(2, "0")}:${String(Math.floor((cs % 6000) / 100)).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
  };
  // Merge runs of the same product so the chip doesn't blink between cuts.
  const runs: { start: number; end: number; shown: number }[] = [];
  for (const s of segments) {
    const last = runs[runs.length - 1];
    if (last && last.shown === s.shown) last.end = s.end;
    else runs.push({ ...s });
  }
  return runs.map((r) => {
    const name = (names[r.shown - 1] ?? `Product ${r.shown}`).replace(/[{}\\]/g, "").toUpperCase().slice(0, 34);
    const score = scores[r.shown - 1];
    return `Dialogue: 2,${t(r.start)},${t(r.end)},Disclaimer,,0,0,0,,{\\an8\\pos(540,250)\\fs50\\b1\\3c&H00111111&}${r.shown}  ${name}${score != null ? `  ·  ${score}/100` : ""}`;
  });
}

export async function runCompareRender(comparisonId: string, jobId: string): Promise<void> {
  const db = supabase();
  const dir = await mkdtemp(join(tmpdir(), "compare-"));
  let lastWrite = 0;
  const report = async (stage: string, percent: number, force = false) => {
    const now = Date.now();
    if (!force && now - lastWrite < 2500) return;
    lastWrite = now;
    const output: RenderProgress = { stage, percent: Math.max(0, Math.min(99, Math.round(percent))), heartbeat: new Date().toISOString() };
    const { data } = await db.from("jobs").update({ output }).eq("id", jobId).eq("status", "running").select("id");
    if (!data || data.length === 0) throw new Cancelled();
  };

  try {
    await report("Getting started", 1, true);
    const { data: cmp } = await db
      .from("comparisons")
      .select("id, scan_ids, script, audio_path, duration_s, words")
      .eq("id", comparisonId)
      .maybeSingle();
    if (!cmp?.script) throw new Error("Create the script first.");
    if (!cmp.audio_path) throw new Error("Generate the voiceover first.");
    const scanIds = cmp.scan_ids as string[];
    const script = parseCompareScript(cmp.script as string, scanIds.length);

    const { data: scanRows } = await db.from("scans").select("id, product_name, overall_score").in("id", scanIds);
    const byId = new Map((scanRows ?? []).map((s) => [s.id as string, s]));
    const names = scanIds.map((id, i) => (byId.get(id)?.product_name as string | null) ?? `Product ${i + 1}`);
    const scores = scanIds.map((id) => (byId.get(id)?.overall_score as number | null) ?? null);

    const { data: mediaRows } = await db
      .from("scan_media")
      .select("id, scan_id, kind, storage_path, sort_order, source_media_id")
      .in("scan_id", scanIds)
      .in("kind", ["product_image", "clip", "product_video"])
      .order("sort_order");
    const media = (mediaRows ?? []) as Row[];

    // Each product's footage: its own videos first (uploads and member videos), else its photos.
    const footage: FootageSource[][] = [];
    for (const [i, scanId] of scanIds.entries()) {
      const mine = media.filter((m) => m.scan_id === scanId);
      const videos = mine.filter((m) => (m.kind === "clip" && !m.source_media_id) || m.kind === "product_video").slice(0, CLIPS_PER_PRODUCT);
      const list: FootageSource[] = [];
      for (const [k, v] of videos.entries()) {
        await report(`Downloading footage for product ${i + 1}`, 1 + (8 * i) / scanIds.length, true);
        const ext = (/\.(mp4|mov|webm|m4v)$/i.exec(v.storage_path)?.[1] ?? "mp4").toLowerCase();
        const file = join(dir, `p${i + 1}-v${k + 1}.${ext}`);
        try {
          await writeFile(file, await getMedia("videos", v.storage_path));
        } catch {
          continue; // a missing file shouldn't sink the whole render
        }
        const length = await probeDuration(file);
        if (length && length > 0.3) list.push({ kind: "video", file, length });
      }
      if (list.length === 0) {
        for (const [k, p] of mine.filter((m) => m.kind === "product_image").slice(0, PHOTOS_PER_PRODUCT).entries()) {
          const file = join(dir, `p${i + 1}-photo${k + 1}.jpg`);
          try {
            await writeFile(file, await getMedia("images", p.storage_path));
            list.push({ kind: "image", file });
          } catch {
            // skip
          }
        }
      }
      footage.push(list);
    }
    if (footage.every((f) => f.length === 0)) throw new Error("None of these products has a photo or video yet.");

    const audioFile = join(dir, (cmp.audio_path as string).endsWith(".wav") ? "voice.wav" : "voice.mp3");
    await writeFile(audioFile, await getMedia("videos", cmp.audio_path as string));
    const words = (cmp.words ?? []) as { text: string; start: number; end: number }[];
    const total = Number(cmp.duration_s) || words[words.length - 1]?.end || 0;
    if (!(total > 0)) throw new Error("The voiceover has no length. Regenerate the voice.");

    const plan = planCompare(script.scenes, words, total, footage);
    if (plan.length === 0) throw new Error("Nothing to put on screen.");
    const segments: RenderSegment[] = plan.map((p) => ({
      kind: p.source.kind,
      file: p.source.file,
      duration: p.end - p.start,
      ...(p.source.kind === "video" ? { fit: "blur" as const, offset: p.offset } : {}),
    }));

    const assFile = join(dir, "captions.ass");
    const ass = buildAss({ words, duration: total, fontName: FONT_NAME });
    await writeFile(assFile, ass.trimEnd() + "\n" + productChips(plan, names, scores).join("\n") + "\n");

    await report("Rendering video", 10, true);
    const outFile = join(dir, "final.mp4");
    let progressError: unknown = null;
    const stop = new AbortController();
    await runFfmpeg(
      buildFfmpegArgs({
        segments,
        audioSeconds: total,
        audioFile,
        assFile,
        fontsDir: process.env.FONTS_DIR ?? join(process.cwd(), "assets", "fonts"),
        outFile,
        total,
        preset: process.env.RENDER_PRESET || "veryfast",
      }),
      undefined,
      (seconds) => {
        report("Rendering video", 10 + 80 * Math.min(1, seconds / total)).catch((e) => {
          progressError = e;
          if (e instanceof Cancelled) stop.abort();
        });
      },
      stop.signal,
    ).catch((e) => {
      throw progressError instanceof Cancelled ? progressError : e;
    });
    if (progressError instanceof Cancelled) throw progressError;

    await report("Uploading", 92, true);
    const key = `comparisons/${comparisonId}/final-${Date.now()}.mp4`;
    await putMedia("videos", key, await readFile(outFile), "video/mp4");
    const saved = await db.from("comparisons").update({ video_path: key, updated_at: new Date().toISOString() }).eq("id", comparisonId);
    if (saved.error) throw new Error(`Saving the video failed: ${saved.error.message}`);

    await db
      .from("jobs")
      .update({ status: "done", output: { stage: "Done", percent: 100, heartbeat: new Date().toISOString(), video_path: key, seconds: Math.round(total) } })
      .eq("id", jobId)
      .eq("status", "running");
  } catch (err) {
    if (err instanceof Cancelled) return;
    console.error("Comparison render failed:", err);
    await db
      .from("jobs")
      .update({ status: "failed", error: err instanceof Error ? err.message : "Render failed." })
      .eq("id", jobId)
      .eq("status", "running");
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
