// When to post. The slot scores are Metricool's "best time to post" values for the
// @fooddiescanner brand (pulled Nov 2026, Eastern time). Higher = more of the audience online.
// Refresh them from Metricool every few weeks as the account's own audience data builds up.

export type SchedulePlatform = "tiktok" | "youtube";
export const SCHEDULE_PLATFORMS: SchedulePlatform[] = ["tiktok", "youtube"];
export const POST_TIMEZONE = "America/New_York";

export function isSchedulePlatform(v: unknown): v is SchedulePlatform {
  return v === "tiktok" || v === "youtube";
}

/** day: 0 = Sunday … 6 = Saturday; hour: local hour (0–23) in POST_TIMEZONE. */
export type Slot = { day: number; hour: number; score: number };

export const BEST_SLOTS: Record<SchedulePlatform, Slot[]> = {
  // TikTok peaks three times a day: 10 AM, noon and 6 PM. Wed/Thu are strongest, weekends about half.
  tiktok: [
    { day: 0, hour: 10, score: 816 }, { day: 0, hour: 12, score: 720 }, { day: 0, hour: 18, score: 677 },
    { day: 1, hour: 10, score: 1089 }, { day: 1, hour: 12, score: 1050 }, { day: 1, hour: 18, score: 1096 },
    { day: 2, hour: 10, score: 1136 }, { day: 2, hour: 12, score: 1082 }, { day: 2, hour: 18, score: 1119 },
    { day: 3, hour: 10, score: 1432 }, { day: 3, hour: 12, score: 1359 }, { day: 3, hour: 18, score: 1386 },
    { day: 4, hour: 10, score: 1471 }, { day: 4, hour: 12, score: 1299 }, { day: 4, hour: 18, score: 1378 },
    { day: 5, hour: 10, score: 1379 }, { day: 5, hour: 12, score: 1251 }, { day: 5, hour: 18, score: 1222 },
    { day: 6, hour: 10, score: 852 }, { day: 6, hour: 12, score: 815 }, { day: 6, hour: 18, score: 709 },
  ],
  // YouTube peaks once, mid-afternoon (2–5 PM, best at 4 PM), with a smaller 10 AM bump on weekdays.
  youtube: [
    { day: 0, hour: 16, score: 5648 }, { day: 0, hour: 17, score: 5417 },
    { day: 1, hour: 10, score: 7794 }, { day: 1, hour: 15, score: 8608 }, { day: 1, hour: 16, score: 9351 },
    { day: 2, hour: 10, score: 8609 }, { day: 2, hour: 16, score: 10353 }, { day: 2, hour: 17, score: 9202 },
    { day: 3, hour: 10, score: 9951 }, { day: 3, hour: 14, score: 10385 }, { day: 3, hour: 15, score: 11147 }, { day: 3, hour: 16, score: 12033 },
    { day: 4, hour: 10, score: 10723 }, { day: 4, hour: 15, score: 10571 }, { day: 4, hour: 16, score: 11979 },
    { day: 5, hour: 10, score: 10537 }, { day: 5, hour: 14, score: 10485 }, { day: 5, hour: 16, score: 10698 },
    { day: 6, hour: 10, score: 5392 }, { day: 6, hour: 16, score: 5880 },
  ],
};

/** Keep posts on one platform at least this far apart, so they don't compete with each other. */
export const MIN_GAP_HOURS: Record<SchedulePlatform, number> = { tiktok: 5, youtube: 20 };
/** Never suggest a slot sooner than this (time to review the video and schedule it in Metricool). */
export const LEAD_MINUTES = 30;
/** How far ahead to look for a good slot (4 days, so a Monday video can still reach Thursday). */
export const WINDOW_HOURS = 96;

export type Suggestion = {
  at: string; // ISO (UTC)
  label: string; // "Wed, Nov 25 · 10:00 AM ET"
  score: number;
  /** Score as a share of this platform's best slot of the week (0–100). */
  strength: number;
  recommended: boolean;
};

// ---------- time zone helpers (no libraries) ----------

/** Offset of `tz` from UTC at instant `ms`, in minutes (New York in winter: -300). */
export function tzOffsetMinutes(ms: number, tz = POST_TIMEZONE): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ms));
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
}

/** The UTC instant of a local wall-clock time in `tz`. */
export function zonedTime(y: number, m: number, d: number, hour: number, tz = POST_TIMEZONE): Date {
  const guess = Date.UTC(y, m - 1, d, hour);
  let ms = guess - tzOffsetMinutes(guess, tz) * 60000;
  // Second pass settles the hour around a daylight-saving switch.
  ms = guess - tzOffsetMinutes(ms, tz) * 60000;
  return new Date(ms);
}

/** Local calendar date (y, m, d) and weekday of instant `ms` in `tz`. */
export function localDate(ms: number, tz = POST_TIMEZONE) {
  const local = new Date(ms + tzOffsetMinutes(ms, tz) * 60000);
  return { y: local.getUTCFullYear(), m: local.getUTCMonth() + 1, d: local.getUTCDate(), day: local.getUTCDay() };
}

export function slotLabel(at: Date, tz = POST_TIMEZONE): string {
  const s = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(at);
  // "Wed, Nov 25, 10:00 AM" → "Wed, Nov 25 · 10:00 AM ET"
  return s.replace(/, (\d{1,2}:\d{2})/, " · $1") + " ET";
}

// ---------- suggestions ----------

/**
 * Best upcoming slots for a platform, in time order. `taken` are times already booked on that
 * platform (scheduled in the app, or marked as scheduled in Metricool); slots too close to them are skipped.
 * The single highest-scoring slot is marked `recommended`.
 */
export function suggestSlots(
  platform: SchedulePlatform,
  now: Date = new Date(),
  taken: Date[] = [],
  opts: { count?: number; windowHours?: number } = {},
): Suggestion[] {
  const count = opts.count ?? 3;
  const windowMs = (opts.windowHours ?? WINDOW_HOURS) * 3_600_000;
  const slots = BEST_SLOTS[platform];
  const top = Math.max(...slots.map((s) => s.score));
  const gap = MIN_GAP_HOURS[platform] * 3_600_000;
  const earliest = now.getTime() + LEAD_MINUTES * 60000;

  const candidates: { at: Date; score: number }[] = [];
  const today = localDate(now.getTime());
  // Walk local calendar days; a whole week is enough to always find something.
  for (let i = 0; i <= 8; i++) {
    const cal = new Date(Date.UTC(today.y, today.m - 1, today.d + i));
    const day = cal.getUTCDay();
    for (const s of slots) {
      if (s.day !== day) continue;
      const at = zonedTime(cal.getUTCFullYear(), cal.getUTCMonth() + 1, cal.getUTCDate(), s.hour);
      const t = at.getTime();
      if (t < earliest) continue;
      if (taken.some((x) => Math.abs(x.getTime() - t) < gap)) continue;
      candidates.push({ at, score: s.score });
    }
  }
  candidates.sort((a, b) => a.at.getTime() - b.at.getTime());

  // Inside the window, keep the best `count` slots, then show them in time order.
  let pool = candidates.filter((c) => c.at.getTime() - now.getTime() <= windowMs);
  if (pool.length === 0) pool = candidates.slice(0, 1);
  const best = [...pool].sort((a, b) => b.score - a.score || a.at.getTime() - b.at.getTime()).slice(0, count);
  best.sort((a, b) => a.at.getTime() - b.at.getTime());
  const bestScore = Math.max(...best.map((b) => b.score));
  let marked = false;
  return best.map((c) => {
    const recommended = !marked && c.score === bestScore;
    if (recommended) marked = true;
    return {
      at: c.at.toISOString(),
      label: slotLabel(c.at),
      score: c.score,
      strength: Math.round((c.score / top) * 100),
      recommended,
    };
  });
}

