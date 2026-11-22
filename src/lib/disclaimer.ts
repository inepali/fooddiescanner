// The disclaimer that goes with every video: burned into its last seconds and added to every post caption.
// Pure (no imports), so the browser, the server and the render worker can all use it.

export const VIDEO_DISCLAIMER =
  "Disclaimer: This video is for general education only and is not medical, nutritional, or legal advice. " +
  "Scores are Fooddie Scanner's opinion of the ingredient list, based on publicly available labels and information at the time of recording. " +
  "Brand names and trademarks belong to their owners; no affiliation or endorsement is implied. " +
  "Inclusion does not mean a product is unsafe or illegally labeled. " +
  "Ingredients and packaging can change, so always check the current label.";

/** How long the disclaimer card stays on screen at the end of the video. */
export const DISCLAIMER_SECONDS = 5;

/** Short notes older captions used in place of the full disclaimer; swapped out when posting. */
const LEGACY_NOTES = [
  /Our opinion of the ingredient list, for information only\. Not medical advice\.?/i,
];

/** Data credit lines that should stay last in a caption (the disclaimer goes before them). */
const CREDIT = /^(Grades and nutrition data|Product data):/im;

/**
 * Makes sure a caption carries the full disclaimer exactly once: replaces an older
 * short note, or adds it before the data credit (or at the end).
 */
export function withDisclaimer(description: string): string {
  const text = description.trim();
  if (text.includes(VIDEO_DISCLAIMER)) return text;
  for (const old of LEGACY_NOTES) {
    if (old.test(text)) return text.replace(old, VIDEO_DISCLAIMER);
  }
  const credit = CREDIT.exec(text);
  if (credit) {
    const before = text.slice(0, credit.index).trim();
    return [before, VIDEO_DISCLAIMER, text.slice(credit.index)].filter(Boolean).join("\n\n");
  }
  return text ? `${text}\n\n${VIDEO_DISCLAIMER}` : VIDEO_DISCLAIMER;
}

/** Index just after the disclaimer (full or legacy) in `text`, or -1. Used to place the public link. */
export function disclaimerEnd(text: string): number {
  const full = text.indexOf(VIDEO_DISCLAIMER);
  if (full >= 0) return full + VIDEO_DISCLAIMER.length;
  const note = /not medical advice\.?/i.exec(text);
  return note ? note.index + note[0].length : -1;
}
