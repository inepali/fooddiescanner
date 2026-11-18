// Signed session cookie for the private scanner (replaces the browser's Basic-auth popup).
// Pure Web Crypto, so it runs in middleware (edge) and in route handlers alike.
// Token: "<expiresAtMs>.<hex HMAC-SHA256(secret, 'fooddie-session:' + expiresAtMs)>".
// The secret is SESSION_SECRET (or APP_PASSWORD on older setups); changing it signs everyone out.
//
// Admin sign-in: with ADMIN_EMAILS set, you sign in on /admin with that Supabase Auth email and
// password. Without it, the old single APP_PASSWORD still works.

/** Key that signs admin session cookies. Unset = the scanner is open (local dev). */
export function sessionSecret(env: Record<string, string | undefined> = process.env): string | undefined {
  return env.SESSION_SECRET || env.APP_PASSWORD || undefined;
}

/** Lowercased admin emails from ADMIN_EMAILS (comma or space separated). */
export function adminEmails(env: Record<string, string | undefined> = process.env): string[] {
  return (env.ADMIN_EMAILS ?? "")
    .split(/[\s,]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** True when the admin scanner is locked (needed before social accounts can be connected). */
export function adminGuarded(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(sessionSecret(env));
}

export const SESSION_COOKIE = "fs_session";
export const SESSION_DAYS = 30;

const enc = new TextEncoder();

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compares two strings without leaking where they differ. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSession(secret: string, now = Date.now(), days = SESSION_DAYS): Promise<string> {
  const exp = now + days * 86_400_000;
  return `${exp}.${await hmac(secret, `fooddie-session:${exp}`)}`;
}

export async function verifySession(secret: string, token: string | undefined, now = Date.now()): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const expText = token.slice(0, dot);
  const exp = Number(expText);
  if (!Number.isFinite(exp) || exp <= now) return false;
  return safeEqual(token.slice(dot + 1), await hmac(secret, `fooddie-session:${expText}`));
}

/** Only same-site paths ("/scan", "/scans/abc?x=1") are allowed as a post-login destination. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/scan";
  if (next.startsWith("/admin") || next.startsWith("/login") || next.startsWith("/api/")) return "/scan";
  return next;
}
