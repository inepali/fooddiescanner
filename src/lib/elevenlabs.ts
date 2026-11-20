import type { Alignment } from "./captions.ts";
import { DELIVERIES, DEFAULT_DELIVERY, type Delivery } from "./delivery.ts";
import { isMock, mockAlignment, silentWav, speechSeconds } from "./mock.ts";
import type { VoiceGroup } from "./voice-groups.ts";

export { VOICE_GROUP_LABELS, type VoiceGroup } from "./voice-groups.ts";

const MODEL = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";

export type Speech = {
  audio: Buffer;
  alignment: Alignment;
  durationSeconds: number;
  mock: boolean;
};

/** Text to speech with character timings (used later for captions). */
/** The JSON body sent to ElevenLabs. Exported so it can be unit tested. */
export function speechBody(text: string, delivery: Delivery = DEFAULT_DELIVERY, model = MODEL) {
  const settings = DELIVERIES[delivery].settings;
  // Leaving voice_settings out makes ElevenLabs use the voice's own saved settings.
  return settings ? { text, model_id: model, voice_settings: settings } : { text, model_id: model };
}

export async function synthesize(text: string, voiceId: string, delivery: Delivery = DEFAULT_DELIVERY): Promise<Speech> {
  if (isMock()) {
    const seconds = speechSeconds(text);
    return {
      audio: silentWav(seconds),
      alignment: mockAlignment(text, seconds),
      durationSeconds: seconds,
      mock: true,
    };
  }

  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY is not set");

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json" },
      body: JSON.stringify(speechBody(text, delivery)),
    },
  );
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    if (res.status === 402 && /paid_plan_required|library voices/i.test(body)) {
      throw new Error(
        "That voice is from the ElevenLabs Voice Library, which needs a paid plan. Pick one of the free default voices from the list.",
      );
    }
    const hint = [401, 402, 403].includes(res.status)
      ? " (check the API key and voice id; free plans can block API use)"
      : "";
    throw new Error(`ElevenLabs ${res.status}${hint}: ${body}`);
  }

  const data = (await res.json()) as { audio_base64?: string; alignment?: Alignment | null };
  if (!data.audio_base64) throw new Error("ElevenLabs returned no audio.");

  const audio = Buffer.from(data.audio_base64, "base64");
  // If timings are missing, fall back to evenly spaced estimates.
  const alignment = data.alignment ?? mockAlignment(text, speechSeconds(text));
  const ends = alignment.character_end_times_seconds;
  const durationSeconds = ends.length ? ends[ends.length - 1] : speechSeconds(text);

  return { audio, alignment, durationSeconds, mock: false };
}

export type Voice = {
  id: string;
  name: string;
  category: string;
  /** Your own clones/designs, ElevenLabs' default voices, or voices added from the Voice Library. */
  group: VoiceGroup;
  /** False only for Voice Library voices, which need a paid plan over the API. */
  free: boolean;
  description: string | null;
};

const GROUP_ORDER: Record<VoiceGroup, number> = { mine: 0, default: 1, library: 2 };

/** Which bucket a voice from /v1/voices belongs in. */
export function voiceGroup(category: string, isOwner: unknown): VoiceGroup {
  if (category === "premade") return "default";
  // Instant clones and Voice Design voices are always made in your own account.
  if ((category === "cloned" || category === "generated") && isOwner !== false) return "mine";
  // Professional clones are yours only if you own them; otherwise they were added from the library.
  if (category === "professional" && isOwner === true) return "mine";
  return "library";
}

/** Maps ElevenLabs' /v1/voices response: your voices first, then defaults, then library voices. */
export function parseVoices(data: unknown): Voice[] {
  const list = (typeof data === "object" && data !== null ? (data as { voices?: unknown }).voices : null) ?? [];
  const voices: Voice[] = [];
  for (const v of Array.isArray(list) ? list : []) {
    if (typeof v !== "object" || v === null) continue;
    const o = v as Record<string, unknown>;
    if (typeof o.voice_id !== "string" || typeof o.name !== "string") continue;
    const category = typeof o.category === "string" ? o.category : "unknown";
    const labels = (typeof o.labels === "object" && o.labels !== null ? o.labels : {}) as Record<string, unknown>;
    const bits = [labels.gender, labels.age, labels.accent, labels.use_case ?? labels.descriptive]
      .filter((x): x is string => typeof x === "string" && x.length > 0)
      .join(", ");
    const group = voiceGroup(category, o.is_owner);
    voices.push({
      id: o.voice_id,
      name: o.name,
      category,
      group,
      free: group !== "library",
      description: bits || null,
    });
  }
  return voices.sort((a, b) => GROUP_ORDER[a.group] - GROUP_ORDER[b.group] || a.name.localeCompare(b.name));
}

export class VoicesPermissionError extends Error {
  constructor() {
    super(
      "This ElevenLabs API key can't list voices (missing the voices_read permission). Paste a voice ID below, or enable Voices > Read on the key in ElevenLabs.",
    );
  }
}

/** Voices in your ElevenLabs account. */
export async function listVoices(): Promise<Voice[]> {
  if (isMock()) {
    return [{ id: "mock-voice", name: "Mock voice (silent)", category: "premade", group: "default", free: true, description: null }];
  }
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY is not set");
  const res = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": key } });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401 && text.includes("voices_read")) throw new VoicesPermissionError();
    throw new Error(`ElevenLabs ${res.status}: ${text.slice(0, 200)}`);
  }
  return parseVoices(await res.json());
}
