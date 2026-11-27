import { supabase } from "@/lib/supabase";
import { synthesize } from "@/lib/elevenlabs";
import { wordsFromAlignment } from "@/lib/captions";
import { isMock } from "@/lib/mock";
import { mediaUrl, putMedia } from "@/lib/storage";
import { parseDelivery } from "@/lib/delivery";
import { COMPARE_MAX_SECONDS, compareNarration, parseCompareScript } from "@/lib/compare-script";
import { getComparison } from "@/lib/comparisons";
import { HttpError, handler, json, paramId } from "@/lib/http";

export const runtime = "nodejs";
// About 3 minutes of speech in one ElevenLabs request.
export const maxDuration = 300;

export const POST = handler(async (req, ctx) => {
  const id = await paramId(ctx);
  const body = (await req.json().catch(() => ({}))) as { voice_id?: string; delivery?: string };
  const delivery = parseDelivery(body.delivery);
  const db = supabase();
  const cmp = await getComparison(db, id);
  if (!cmp?.script) throw new HttpError("Create the script first.");

  const text = compareNarration(parseCompareScript(cmp.script, cmp.scan_ids.length));
  // A comparison runs about 3x a single-product video, so it has its own, larger guard.
  const maxChars = Number(process.env.MAX_COMPARE_VOICE_CHARS ?? 4500);
  if (text.length > maxChars) throw new HttpError(`Script is ${text.length} characters; the limit is ${maxChars}. Shorten it first.`);

  const { data: settings } = await db.from("settings").select("default_voice_id").eq("id", 1).maybeSingle();
  const voiceId: string = body.voice_id || settings?.default_voice_id || process.env.ELEVENLABS_VOICE_ID || "";
  if (!voiceId && !isMock()) throw new HttpError("Set a default voice first (Voice tab on any scan, or ELEVENLABS_VOICE_ID).");

  const { data: job } = await db.from("jobs").insert({ comparison_id: id, step: "voice", status: "running" }).select("id").single();
  try {
    const speech = await synthesize(text, voiceId, delivery);
    const path = `comparisons/${id}/voice-${Date.now()}.${speech.mock ? "wav" : "mp3"}`;
    await putMedia("videos", path, speech.audio, speech.mock ? "audio/wav" : "audio/mpeg");
    const words = wordsFromAlignment(speech.alignment);
    const { error } = await db
      .from("comparisons")
      .update({
        voice_id: voiceId || null,
        audio_path: path,
        duration_s: speech.durationSeconds,
        alignment: speech.alignment,
        words,
        video_path: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw new Error(`Saving the voiceover failed: ${error.message}`);
    if (job) await db.from("jobs").update({ status: "done", output: { characters: text.length, mock: speech.mock } }).eq("id", job.id);
    return json({
      audio_url: await mediaUrl("videos", path),
      duration_s: speech.durationSeconds,
      warning:
        speech.durationSeconds > COMPARE_MAX_SECONDS
          ? "The voiceover runs over 5 minutes. Shorten the script."
          : speech.durationSeconds < 170
            ? "The voiceover is under 3 minutes. Fine to use, or add a round to the script."
            : null,
    });
  } catch (err) {
    if (job) await db.from("jobs").update({ status: "failed", error: err instanceof Error ? err.message : "Voice failed." }).eq("id", job.id);
    throw err;
  }
});
