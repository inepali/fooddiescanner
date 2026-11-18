// Rules for member submissions (client-safe, unit tested).
// A submission = one label photo + one product photo + the member's own ~60 second video.

export const VIDEO_MIN_S = 45;
export const VIDEO_MAX_S = 75;

/** Scans a member can start per rolling 24 hours (each one costs an AI label read). */
export function dailyScanLimit(env: string | undefined = process.env.MEMBER_DAILY_SCANS): number {
  const n = Math.round(Number(env));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 100) : 5;
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
export const PARTS: { id: Part; label: string }[] = [
  { id: "label", label: "Ingredient label photo" },
  { id: "product_image", label: "Product photo" },
  { id: "product_video", label: "Your 60-second video" },
];

/** Which parts are still missing, in the order they're asked for. */
export function missingParts(have: Iterable<string>): Part[] {
  const set = new Set(have);
  return PARTS.map((p) => p.id).filter((p) => !set.has(p));
}
