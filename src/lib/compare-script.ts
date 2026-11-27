import { generateText } from "./llm.ts";
import { groupFor, pickCandidates } from "./script.ts";
import { DEFAULT_TONE, TONES, type Tone } from "./tones.ts";

// A ~3-minute vertical comparison video of 2 to 4 scanned products: a hook, a quick
// intro of each product, head-to-head rounds, a verdict (the AI's opinion, or the
// winner you chose) and an outro. Each scene names the product whose footage is on
// screen (1-based), or none for scenes about all of them.

export type CompareSection = "hook" | "intro" | "round" | "verdict" | "outro";
export const COMPARE_SECTIONS: CompareSection[] = ["hook", "intro", "round", "verdict", "outro"];

export type CompareScene = { section: CompareSection; product: number | null; seconds: number; voiceover: string; edited?: boolean };
export type CompareVerdict = {
  /** 1-based product number. */
  winner: number;
  /** Every product number, best first. */
  ranking: number[];
  /** One or two sentences for you (not spoken) on why. */
  summary: string;
};
export type CompareScript = { title: string; verdict: CompareVerdict; scenes: CompareScene[] };

export type CompareProduct = {
  name: string;
  overall: number;
  allergens: string[];
  ingredients: { name: string; score: number; reason: string | null }[];
  offFacts?: string | null;
};

/** About 2.5 spoken words per second: 3 minutes is roughly 450 words. */
export const COMPARE_MIN_WORDS = 420;
export const COMPARE_MAX_WORDS = 540;
export const COMPARE_TARGET_SECONDS = 180;
/** The longest a comparison video may run. */
export const COMPARE_MAX_SECONDS = 300;
export const MAX_PRODUCTS = 4;
export const MIN_PRODUCTS = 2;

function feel(overall: number): string {
  return overall >= 70 ? "mostly on the good side" : overall >= 45 ? "a mixed bag" : "mostly on the concerning side";
}

/** The AI's own pick when nothing is forced: highest overall score, ties broken by fewer poor ingredients. */
export function suggestedRanking(products: CompareProduct[]): number[] {
  return products
    .map((p, i) => ({ n: i + 1, overall: p.overall, poor: p.ingredients.filter((x) => groupFor(x.score) === "poor").length }))
    .sort((a, b) => b.overall - a.overall || a.poor - b.poor || a.n - b.n)
    .map((x) => x.n);
}

export function buildComparePrompt(products: CompareProduct[], opts: { tone?: Tone; forcedWinner?: number | null } = {}): string {
  const tone = TONES[opts.tone ?? DEFAULT_TONE];
  const n = products.length;
  const blocks = products
    .map((p, i) => {
      const c = pickCandidates(p.ingredients);
      const list = (xs: typeof c.best) =>
        xs.length ? xs.map((x) => `    - ${x.name} [${x.group}] (#${x.position} on the label)${x.reason ? `: ${x.reason.slice(0, 140)}` : ""}`).join("\n") : "    (none)";
      return `PRODUCT ${i + 1}: ${p.name}
  - Overall feel (never say a number): ${feel(p.overall)}; internal score ${p.overall}/100 for ranking only
  - Ingredients on the label: ${p.ingredients.length} (${c.counts.good} good, ${c.counts.fair} fair, ${c.counts.poor} poor)
  - Allergens: ${p.allergens.join(", ") || "none stated"}
${p.offFacts ? `  - Open Food Facts: ${p.offFacts}\n` : ""}  - Best ingredients:
${list(c.best)}
  - Worst ingredients:
${list(c.worst)}`;
    })
    .join("\n\n");

  const ranking = suggestedRanking(products);
  const forced = opts.forcedWinner && opts.forcedWinner >= 1 && opts.forcedWinner <= n ? opts.forcedWinner : null;
  const verdictRule = forced
    ? `THE WINNER IS FIXED: product ${forced} (${products[forced - 1].name}). The admin chose it. Build the verdict around it honestly: explain what makes it the pick by its ingredient list, and still mention its weak spots.`
    : `PICK THE WINNER YOURSELF from the facts. The internal scores suggest this order (best first): ${ranking.join(", ")}. You may break a near tie (within 5 points) on ingredient quality, label length or allergens, but say why in "summary".`;

  return `You write a 3-minute vertical (9:16) comparison video for TikTok, Instagram Reels and YouTube Shorts that puts ${n} packaged foods head to head by reading their ingredient labels. You never say or show any numeric score out loud.

TONE: ${tone.prompt}

FACTS (the only facts you may use)
${blocks}

${verdictRule}

Return ONLY a JSON object (no markdown fences) shaped like:
{ "title": string, "verdict": { "winner": integer, "ranking": [integer, ...], "summary": string }, "scenes": [ { "section": "hook" | "intro" | "round" | "verdict" | "outro", "product": integer | null, "seconds": integer, "voiceover": string } ] }

"product" is the product number whose footage is on screen during that scene (1 to ${n}), or null when the scene talks about all of them. "ranking" lists every product number, best first, starting with the winner. "summary" is one or two sentences for the admin, not spoken.

STRUCTURE (in this order, 14 to 22 scenes, "seconds" adding up to about ${COMPARE_TARGET_SECONDS}):
1. "hook" (about 6 s, product null): the most surprising TRUE contrast between these products, in 10 words or fewer for the first sentence ("Same aisle. Very different labels."). Within the first five seconds say the product type in plain search words ("Which granola bar is actually healthiest?"). Promise a winner at the end.
2. "intro" (one short scene per product, about 8 s each, product set): name it and the one thing that stands out on its label.
3. "round" (3 to 5 rounds, each one or more scenes, each scene showing the product it talks about): pick rounds that really separate these labels, for example "ingredient count", "added sugar and where it sits on the label", "oils and fats", "additives", "allergens", "processing (NOVA)". Each round names a round winner by your read. Cover each product's best and worst ingredients from the lists above across the rounds. Use label position as drama ("sugar is number two on this one, number six on that one").
4. "verdict" (about 25 s, 2 or 3 scenes): count down the ranking from last place to the winner, then the winner scene (product set to the winner). Frame it as your opinion of the ingredient lists ("by my read", "in my book"), and give the runner-up one honest compliment.
5. "outro" (about 12 s, product null): a "what to look for" tip as concrete label rules, one quotable "send this to someone who…" line, a question that invites comments ("Which one is in your cart?"), then "Comment your pick and follow for the next matchup."

KEEP PEOPLE WATCHING: plant an open-loop teaser at about 0:15, 0:60 and 2:00 ("The next round flips everything."), and pay each one off within the next 20 seconds. Never promise what the video does not deliver.

RULES
- LENGTH IS A HARD LIMIT: total narration between ${COMPARE_MIN_WORDS} and ${COMPARE_MAX_WORDS} words (aim for about 450), about 2.5 words per second of each scene. Short punchy sentences, mostly 12 words or fewer.
- Only talk about the ingredients and facts listed above. No invented numbers, studies or ingredients. Never say a numeric score.
- Health statements must be widely accepted nutrition basics, phrased with "may", "can" or "tends to". No disease claims, no "cures", "detox" or weight-loss promises, no scare tactics, no shaming.
- OPINION, NOT FACT: the winner and every round call is your opinion of the ingredient lists. Never say or suggest a product is unsafe, dangerous, harmful, toxic, illegal, banned, contaminated or mislabeled.
- TALK ABOUT INGREDIENTS, NOT COMPANIES: never say or suggest a brand is lying, misleading, hiding or tricking anyone. Never tell viewers to stop buying, boycott or throw out a product. Name a product only as it is listed above.
- "title": a short curiosity-driven title under 60 characters that names the matchup.`;
}

export function parseCompareScript(text: string, productCount: number): CompareScript {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Model returned no JSON");
  const data = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  const valid = (v: unknown) => {
    const x = Math.round(Number(v));
    return Number.isInteger(x) && x >= 1 && x <= productCount ? x : null;
  };

  const scenes: CompareScene[] = [];
  for (const s of Array.isArray(data.scenes) ? data.scenes.slice(0, 40) : []) {
    if (typeof s !== "object" || s === null) continue;
    const o = s as Record<string, unknown>;
    const voiceover = typeof o.voiceover === "string" ? o.voiceover.trim() : "";
    if (!voiceover) continue;
    const seconds = Math.round(Number(o.seconds));
    scenes.push({
      section: COMPARE_SECTIONS.find((x) => x === o.section) ?? "round",
      product: o.product === null || o.product === undefined ? null : valid(o.product),
      seconds: Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 60) : 8,
      voiceover,
    });
  }
  if (scenes.length === 0) throw new Error("The script has no scenes.");

  const v = (typeof data.verdict === "object" && data.verdict !== null ? data.verdict : {}) as Record<string, unknown>;
  const ranked = (Array.isArray(v.ranking) ? v.ranking : []).map(valid).filter((x): x is number => x !== null);
  const winner = valid(v.winner) ?? ranked[0] ?? 1;
  // Winner first, every product exactly once.
  const ranking = [winner, ...ranked.filter((x) => x !== winner)];
  for (let i = 1; i <= productCount; i++) if (!ranking.includes(i)) ranking.push(i);
  const dedup = [...new Set(ranking)];

  return {
    title: typeof data.title === "string" && data.title.trim() ? data.title.trim().slice(0, 100) : "Which one wins?",
    verdict: { winner, ranking: dedup, summary: typeof v.summary === "string" ? v.summary.trim().slice(0, 500) : "" },
    scenes,
  };
}

export function compareNarration(script: CompareScript): string {
  return script.scenes
    .map((s) => s.voiceover.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ");
}

export function compareWordCount(script: CompareScript): number {
  return script.scenes.reduce((n, s) => n + (s.voiceover.trim() ? s.voiceover.trim().split(/\s+/).length : 0), 0);
}

/** Writes the script, retrying once with a nudge when the length misses by a lot. */
export async function createCompareScript(products: CompareProduct[], opts: { tone?: Tone; forcedWinner?: number | null } = {}): Promise<CompareScript> {
  const prompt = buildComparePrompt(products, opts);
  let script = parseCompareScript(await generateText(prompt), products.length);
  const words = compareWordCount(script);
  if (words < COMPARE_MIN_WORDS - 60 || words > COMPARE_MAX_WORDS + 60) {
    const nudge = `\n\nYOUR LAST DRAFT HAD ${words} WORDS. It must be between ${COMPARE_MIN_WORDS} and ${COMPARE_MAX_WORDS}. ${words < COMPARE_MIN_WORDS ? "Add depth to the rounds." : "Cut filler and merge scenes."}`;
    try {
      const retry = parseCompareScript(await generateText(prompt + nudge), products.length);
      const rw = compareWordCount(retry);
      if (Math.abs(rw - 450) < Math.abs(words - 450)) script = retry;
    } catch {
      // keep the first draft
    }
  }
  const forced = opts.forcedWinner;
  if (forced && forced >= 1 && forced <= products.length && script.verdict.winner !== forced) {
    script.verdict = { ...script.verdict, winner: forced, ranking: [forced, ...script.verdict.ranking.filter((x) => x !== forced)] };
  }
  return script;
}
