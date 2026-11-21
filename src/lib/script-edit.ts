import { generateText } from "./llm.ts";
import { SECTIONS, MAX_WORDS, type VideoScene, type VideoScript } from "./script.ts";

// Hand edits to a saved script: change, add or remove voiceover lines without rewriting the
// whole script, and optionally let the model polish one line or the whole thing.

const MAX_SCENES = 30;
const MAX_LINE = 400;
const MAX_TITLE = 100;

/** About 2.5 spoken words per second, at least 2 seconds a line. */
export function secondsFor(text: string): number {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return Math.max(2, Math.round(words / 2.5));
}

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/**
 * Turns what the editor sent into a safe script. Lines whose text changed (or are new) are
 * marked `edited`, so the count fixer and the closing-line check never rewrite your words, and
 * their length is re-timed from the word count. The visual, photo and "tomorrow's scan" carry
 * over from the saved script.
 */
export function applyEdits(previous: VideoScript, input: unknown): VideoScript {
  const o = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const rows = Array.isArray(o.scenes) ? o.scenes.slice(0, MAX_SCENES) : [];
  const scenes: VideoScene[] = [];
  for (const row of rows) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as Record<string, unknown>;
    const voiceover = clean(r.voiceover, MAX_LINE);
    if (!voiceover) continue; // an emptied line is a deleted line
    const from = Number.isInteger(r.from) ? previous.scenes[r.from as number] : undefined;
    const section = SECTIONS.find((x) => x === r.section) ?? from?.section;
    const changed = !from || from.voiceover.trim() !== voiceover;
    scenes.push({
      seconds: changed ? secondsFor(voiceover) : from.seconds,
      visual: from?.visual ?? "Your own line (keeps the picture from the scene before it)",
      voiceover,
      ...(from?.photo ? { photo: from.photo } : {}),
      ...(section ? { section } : {}),
      ...(from?.custom && !changed ? { custom: true } : {}), // a saved line you rewrote here becomes this script's own
      ...(changed || from?.edited ? { edited: true } : {}),
    });
  }
  if (scenes.length === 0) throw new Error("The script needs at least one line.");
  const title = clean(o.title, MAX_TITLE) || previous.title;
  return { title, scenes, ...(previous.next ? { next: previous.next } : {}) };
}

export type RefineInput = {
  script: VideoScript;
  /** Refine only this line (0-based); omit to polish the whole script lightly. */
  scene?: number;
  /** What you want, e.g. "punchier", "mention it's sold at Costco". Optional. */
  instruction?: string;
  productName: string | null;
  /** The label's ingredients, so the model can't invent new ones. */
  ingredients: string[];
};

export function buildRefinePrompt(i: RefineInput): string {
  const one = i.scene !== undefined;
  const lines = i.script.scenes.map((s, n) => `${n}. [${s.section ?? "line"}] ${s.voiceover}`).join("\n");
  return `You are polishing the voiceover of a ~60-second TikTok / Reels video about a packaged food's ingredient label. The creator already edited it by hand: keep their meaning, facts and wording choices, and change as little as needed.

Product: ${i.productName ?? "unnamed product"}
Ingredients on the label (talk about no others): ${i.ingredients.slice(0, 60).join(", ") || "n/a"}

CURRENT LINES (index. [section] text):
${lines}

TASK: ${
    one
      ? `Rewrite ONLY line ${i.scene}. Keep it about the same length (within a few words), and make it flow from the line before into the line after.`
      : `Lightly polish every line for rhythm and flow. Keep the same number of lines, in the same order, each about the same length. Total must stay under ${MAX_WORDS} words.`
  }
${i.instruction ? `CREATOR'S REQUEST: ${i.instruction.slice(0, 300)}` : "Make it sound natural out loud: short punchy sentences, speak to \"you\", no filler."}

RULES
- Spoken words only: no emoji, no stage directions, no hashtags, no numeric score.
- Health statements stay cautious ("may", "can"); no disease claims, no "detox", no scare tactics. Invent no numbers or studies.
- Keep any call to action, question or "tomorrow" teaser that is already there.

Return ONLY JSON, no markdown fences: ${one ? '{ "voiceover": string }' : '{ "lines": [string, ...] }'}`;
}

/** Applies the model's answer. Refined lines are marked `edited` and re-timed. */
export function parseRefine(text: string, i: RefineInput): VideoScript {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Model returned no JSON");
  const data = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  const set = (sc: VideoScene, v: unknown): VideoScene => {
    const voiceover = clean(v, MAX_LINE);
    return voiceover && voiceover !== sc.voiceover ? { ...sc, voiceover, seconds: secondsFor(voiceover), edited: true } : sc;
  };
  if (i.scene !== undefined) {
    const scenes = i.script.scenes.map((sc, n) => (n === i.scene ? set(sc, data.voiceover) : sc));
    return { ...i.script, scenes };
  }
  const out = Array.isArray(data.lines) ? data.lines : [];
  if (out.length !== i.script.scenes.length) throw new Error("The AI changed the number of lines. Try again.");
  return { ...i.script, scenes: i.script.scenes.map((sc, n) => set(sc, out[n])) };
}

export async function refineScript(i: RefineInput): Promise<VideoScript> {
  if (i.scene !== undefined && (i.scene < 0 || i.scene >= i.script.scenes.length)) throw new Error("That line doesn't exist.");
  return parseRefine(await generateText(buildRefinePrompt(i)), i);
}

