// Opening-line styles for the video script. The model used to copy the prompt's
// example ("Is this actually healthy?"), so every video opened the same way. Now
// code picks one style per script, rotating away from the last few used, and the
// prompt only shows that style.

export type HookStyleId = "shock" | "challenge" | "myth" | "store" | "story" | "verdict";

export type HookStyle = {
  id: HookStyleId;
  /** What the opening must do, for the prompt. */
  rule: string;
  /** Example lines (the model adapts, never copies). */
  examples: string[];
};

export const HOOK_STYLES: HookStyle[] = [
  {
    id: "shock",
    rule: "SHOCKING FACT: open with one surprising, specific, TRUE fact from this label (where an ingredient sits, how long the list is, a surprising additive). A statement, not a question.",
    examples: ["Sugar is the second ingredient. In a breakfast bar.", "Twenty-three ingredients. For a cracker."],
  },
  {
    id: "challenge",
    rule: "CHALLENGE: open by putting the viewer on the spot about their own choice or a guess (would they buy it, pack it, guess an ingredient's position).",
    examples: ["Would you pack this in a lunchbox? Watch first.", "Guess what's listed right after the oats."],
  },
  {
    id: "myth",
    rule: "MYTH BUST: open by quoting a front-of-pack claim or a common belief about this kind of product, then hint that the ingredient list tells its own story. Neutral, never accuse the brand.",
    examples: ["The front says 'natural'. Let's read the back.", "Everyone calls this the smart snack. Let's check."],
  },
  {
    id: "store",
    rule: "STORE ANGLE: open with where it is sold or how often people buy it (a weekly staple, a best-seller, the snack aisle), then \"I flipped it over.\" Never invent sales figures or rankings.",
    examples: ["A cart staple at every warehouse store. I flipped it over.", "You've walked past this a hundred times. Here's the back."],
  },
  {
    id: "story",
    rule: "STORY: open first-person, in one or two short lines: you were about to buy or eat it, then one ingredient made you stop and read.",
    examples: ["I almost bought this. Then I read ingredient number four.", "This was in my cart until I flipped it over."],
  },
  {
    id: "verdict",
    rule: "VERDICT FIRST: open with your verdict in words (never a number), then tease the one ingredient that decided it.",
    examples: ["Better than I expected. Except for one thing.", "Mostly fine. One ingredient changes the story."],
  },
];

export function hookStyle(id: string | undefined): HookStyle | undefined {
  return HOOK_STYLES.find((h) => h.id === id);
}

/** Picks a style not used in the last three scripts (newest first). */
export function pickHookStyle(recent: string[] = [], rand: () => number = Math.random): HookStyle {
  const avoid = new Set(recent.slice(0, 3));
  const pool = HOOK_STYLES.filter((h) => !avoid.has(h.id));
  const from = pool.length ? pool : HOOK_STYLES;
  return from[Math.min(from.length - 1, Math.floor(rand() * from.length))];
}

/** The tired openers every script used to start with. */
const BANNED_OPENING = /^\W*(?:(?:so|okay|ok|hey|guys)[,!.\s]+)*(?:healthy\b|looks healthy|is (?:this|it|that)\b[^.?!]{0,40}\bhealthy\b|is [^.?!]{0,40}\bactually healthy\b|but is it healthy)/i;

export function hasBannedOpening(firstLine: string): boolean {
  return BANNED_OPENING.test(firstLine.trim());
}
