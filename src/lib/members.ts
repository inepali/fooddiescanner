// Member (rewards program) helpers that don't touch the network, so they can be unit tested.
// Members sign in with Supabase email + password. The admin signs in on /admin (see session.ts).

export const MEMBER_ACCESS_COOKIE = "fs_member_at";
export const MEMBER_REFRESH_COOKIE = "fs_member_rt";
/** Readable by the page (not httpOnly) and holds no secret: it only tells the static header to show "Log out". */
export const MEMBER_HINT_COOKIE = "fs_member";
export const MEMBER_DAYS = 30;
export const MIN_PASSWORD = 8;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return s.length <= 254 && EMAIL.test(s) ? s : null;
}

export function passwordProblem(v: unknown): string | null {
  if (typeof v !== "string" || v.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (v.length > 72) return "Use 72 characters or fewer.";
  return null;
}

/** Public name on the leaderboard: 3-24 of a-z, 0-9 and _. */
export function normalizeHandle(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim().replace(/^@/, "").toLowerCase() : "";
  return /^[a-z0-9_]{3,24}$/.test(s) ? s : null;
}

/** Invite codes are 6-12 letters/digits, case and spaces ignored. Empty = no code. */
export function normalizeInviteCode(v: unknown): string | null {
  const s = typeof v === "string" ? v.replace(/[\s-]/g, "").toUpperCase() : "";
  return /^[A-Z0-9]{6,12}$/.test(s) ? s : null;
}

/** E.164. A bare 10-digit number (or 11 starting with 1) is taken as US. */
export function normalizePhone(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const plus = v.trim().startsWith("+");
  const digits = v.replace(/\D/g, "");
  if (!plus) {
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    return null;
  }
  return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
}

/** TikTok username: 2-24 of a-z, 0-9, "." and "_", with or without the @ or a profile link. */
export function normalizeTiktok(v: unknown): string | null {
  if (typeof v !== "string") return null;
  let s = v.trim();
  const link = s.match(/tiktok\.com\/@([^/?#\s]+)/i);
  if (link) s = link[1];
  s = s.replace(/^@/, "").toLowerCase();
  return /^[a-z0-9._]{2,24}$/.test(s) && !s.endsWith(".") ? s : null;
}

/** Random invite code without look-alike characters (0/O, 1/I/L). */
export function newInviteCode(length = 8, rand: (n: number) => number = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n): string {
  const abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) out += abc[rand(abc.length)];
  return out;
}

export type RewardCheck = { emailConfirmed: boolean; phone: string | null; tiktok: string | null };

/** What is still missing before this member's rewards can be paid out. Empty = ready. */
export function rewardsMissing(m: RewardCheck): ("email" | "phone" | "tiktok")[] {
  const out: ("email" | "phone" | "tiktok")[] = [];
  if (!m.emailConfirmed) out.push("email");
  if (!m.phone) out.push("phone");
  if (!m.tiktok) out.push("tiktok");
  return out;
}

/** Only same-site member pages are allowed after sign-in. */
export function memberNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || next.startsWith("/api/")) return "/me";
  return next;
}
