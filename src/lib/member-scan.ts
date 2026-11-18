// Rules for member submissions (client-safe, unit tested).
// Scanners and video contributors submit separately:
//   scan  = ingredient label photo (or barcode) + product photo (read and scored right away)
//   video = product photo + the member's own ~60 second video (+ product name, optional barcode), reviewed by the admin

export const VIDEO_MIN_S = 45;
export const VIDEO_MAX_S = 75;

/** Submissions a member can make per rolling 24 hours (each one costs an AI label read). Default 1. */
export function dailySubmitLimit(env: string | undefined = process.env.MEMBER_DAILY_SUBMISSIONS): number {
  const n = Math.round(Number(env));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 100) : 1;
}

/**
 * When the member may submit again, or null if they may now. `recent` = their submission
 * times (ms) in the last 24 hours; the oldest one leaving the window frees a slot.
 */
export function nextSubmitAt(recent: number[], limit: number, now = Date.now()): number | null {
  const inWindow = recent.filter((t) => t > now - 86_400_000).sort((a, b) => a - b);
  if (inWindow.length < limit) return null;
  return inWindow[inWindow.length - limit] + 86_400_000;
}

/** "in 3 h", "in 25 min" */
export function waitText(until: number, now = Date.now()): string {
  const mins = Math.max(1, Math.ceil((until - now) / 60_000));
  return mins >= 60 ? `in ${Math.ceil(mins / 60)} h` : `in ${mins} min`;
}

/** A problem with the video's length, or null if it's fine. */
export function videoLengthProblem(seconds: unknown): string | null {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return "Couldn’t read the video’s length. Try another file.";
  if (s < VIDEO_MIN_S) return `Your video is ${Math.round(s)} s. Make it about a minute (at least ${VIDEO_MIN_S} s).`;
  if (s > VIDEO_MAX_S) return `Your video is ${Math.round(s)} s. Keep it to about a minute (${VIDEO_MAX_S} s max).`;
  return null;
}

export type Part = "label" | "product_image" | "product_video";
export type SubmissionKind = "scan" | "video";

export const PART_LABELS: Record<Part, string> = {
  label: "Ingredient label photo",
  product_image: "Product photo",
  product_video: "Your 60-second video",
};

const KIND_PARTS: Record<SubmissionKind, Part[]> = {
  scan: ["label", "product_image"],
  video: ["product_image", "product_video"],
};

export function submissionKind(v: unknown): SubmissionKind {
  return v === "video" ? "video" : "scan";
}

/** The parts a submission of this kind needs, in the order they're asked for. */
export function partsFor(kind: SubmissionKind): { id: Part; label: string }[] {
  return KIND_PARTS[kind].map((id) => ({ id, label: PART_LABELS[id] }));
}

/**
 * Which of this kind's parts are still missing, in order. A barcode found on Open Food Facts
 * (with its ingredient list) stands in for the label photo.
 */
export function missingParts(have: Iterable<string>, kind: SubmissionKind = "scan", opts: { barcode?: boolean } = {}): Part[] {
  const set = new Set(have);
  if (opts.barcode) set.add("label");
  return KIND_PARTS[kind].filter((p) => !set.has(p));
}

/** Video contributors are members invited at the "creator" tier. */
export function canSubmit(kind: SubmissionKind, tier: string): boolean {
  return kind === "scan" || tier === "creator";
}

/** Product name typed by a video contributor: 2-80 characters, whitespace tidied. */
export function normalizeProductName(v: unknown): string | null {
  const s = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
  return s.length >= 2 && s.length <= 80 ? s : null;
}

/** The notice a member gets when their submission is accepted. */
export function acceptedMessage(kind: SubmissionKind, product: string | null): string {
  const name = product?.trim() || "your product";
  return kind === "video" ? `Your video for ${name} was accepted! 🎉` : `Your scan of ${name} was accepted! 🎉`;
}
