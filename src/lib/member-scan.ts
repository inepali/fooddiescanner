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

/** Up to this many clips per video submission; together they make the ~1 minute video. */
export const MAX_MEMBER_VIDEOS = 5;
/** Shortest clip worth keeping. */
export const CLIP_MIN_S = 3;

/** A problem with one clip's length, or null. Each clip may be short; the total is checked by videoTotalProblem. */
export function clipLengthProblem(seconds: unknown): string | null {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return "Couldn’t read the video’s length. Try another file.";
  if (s < CLIP_MIN_S) return `That clip is under ${CLIP_MIN_S} s. Record a little longer.`;
  if (s > VIDEO_MAX_S) return `That clip is ${Math.round(s)} s. Keep each clip to ${VIDEO_MAX_S} s or less.`;
  return null;
}

/** All clips together must add up to about a minute (at least VIDEO_MIN_S). Null when fine. */
export function videoTotalProblem(seconds: number[]): string | null {
  if (seconds.length === 0) return "Add your video first.";
  if (seconds.length > MAX_MEMBER_VIDEOS) return `Up to ${MAX_MEMBER_VIDEOS} clips.`;
  const total = seconds.reduce((a, b) => a + (Number(b) || 0), 0);
  if (total < VIDEO_MIN_S) return `Your clips add up to ${Math.round(total)} s. Make it about a minute (at least ${VIDEO_MIN_S} s in total).`;
  return null;
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

/** Points per action. Keep in step with supabase/migrations/0019_photo_and_video_points.sql. */
export const POINTS = { scan: 10, photo: 20, first_scan: 20, video: 1000 } as const;

/** What each step of a submission earns (the video's points land when it's accepted). */
export const PART_POINTS: Record<Part, number> = {
  label: POINTS.scan,
  product_image: POINTS.photo,
  product_video: POINTS.video,
};

/** Points a complete submission of this kind earns (not counting first-to-scan). */
export function submissionPoints(kind: SubmissionKind): number {
  return KIND_PARTS[kind].reduce((sum, p) => sum + PART_POINTS[p], 0);
}

/** "1,000" */
export function formatPoints(n: number): string {
  return n.toLocaleString("en-US");
}

export const PART_LABELS: Record<Part, string> = {
  label: "Ingredient label photo",
  product_image: "Product photo",
  product_video: "Your video (one minute, up to 5 clips)",
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
  return kind === "video"
    ? `Your video for ${name} was accepted! +${formatPoints(submissionPoints("video"))} points 🎉`
    : `Your scan of ${name} was accepted! 🎉`;
}
