// Auto-advance: with the switch on, after IDLE_SECONDS without a tap the app does the next step for you.
// Order: script, voice, video (only once you have uploaded clips), social copy, public page.
// Connect & Post is never automatic.

export const IDLE_SECONDS = 120;

export type AutoStep = "script" | "voice" | "social" | "public" | "video";

export const AUTO_LABEL: Record<AutoStep, string> = {
  script: "write the script",
  voice: "make the voice",
  social: "write the social copy",
  public: "publish the public page",
  video: "render the final video",
};

export type AutoState = {
  hasScript: boolean;
  hasAudio: boolean;
  hasCopy: boolean;
  isPublic: boolean;
  uploadedClips: number;
  hasVideo: boolean;
  rendering: boolean;
};

/** The next step to do, or null when everything automatic is done (or can't start yet). */
export function nextAutoStep(s: AutoState): AutoStep | null {
  if (!s.hasScript) return "script";
  if (!s.hasAudio) return "voice";
  if (!s.hasVideo && !s.rendering && s.uploadedClips > 0) return "video";
  if (!s.hasCopy) return "social";
  if (!s.isPublic) return "public";
  return null;
}

/** Whole seconds left before the next step starts. */
export function secondsLeft(idleMs: number): number {
  return Math.max(0, Math.ceil(IDLE_SECONDS - idleMs / 1000));
}
