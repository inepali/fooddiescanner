import { createClient, type Session, type User } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";
import { MEMBER_ACCESS_COOKIE, MEMBER_DAYS, MEMBER_HINT_COOKIE, MEMBER_REFRESH_COOKIE } from "./members.ts";
import { supabase } from "./supabase.ts";

// Server-side Supabase Auth for members. Tokens live in httpOnly cookies; the browser never
// talks to Supabase directly, so the database stays server-only (RLS on, no policies).

/** A fresh auth client per call (never shares a session between requests). */
export function authClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

export function setMemberCookies(res: NextResponse, session: Session, secure: boolean) {
  const base = { httpOnly: true, secure, sameSite: "lax" as const, path: "/" };
  res.cookies.set(MEMBER_ACCESS_COOKIE, session.access_token, { ...base, maxAge: session.expires_in ?? 3600 });
  res.cookies.set(MEMBER_REFRESH_COOKIE, session.refresh_token, { ...base, maxAge: MEMBER_DAYS * 86_400 });
  res.cookies.set(MEMBER_HINT_COOKIE, "1", { ...base, httpOnly: false, maxAge: MEMBER_DAYS * 86_400 });
}

export function clearMemberCookies(res: NextResponse) {
  res.cookies.set(MEMBER_ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(MEMBER_REFRESH_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(MEMBER_HINT_COOKIE, "", { path: "/", maxAge: 0 });
}

export type Member = {
  user: User;
  id: string;
  email: string;
  emailConfirmed: boolean;
  handle: string | null;
  tier: "scanner" | "creator";
  phone: string | null;
  tiktok: string | null;
};

async function loadMember(user: User): Promise<Member | null> {
  const { data } = await supabase()
    .from("creators")
    .select("handle, tier, phone, tiktok_handle, banned")
    .eq("id", user.id)
    .maybeSingle();
  if (!data || data.banned) return null;
  return {
    user,
    id: user.id,
    email: user.email ?? "",
    emailConfirmed: Boolean(user.email_confirmed_at),
    handle: data.handle,
    tier: data.tier,
    phone: data.phone,
    tiktok: data.tiktok_handle,
  };
}

/** The member for this access token, or null (expired, unknown, banned). */
export async function memberFromToken(accessToken: string | undefined): Promise<Member | null> {
  if (!accessToken) return null;
  const { data, error } = await authClient().auth.getUser(accessToken);
  if (error || !data.user) return null;
  return loadMember(data.user);
}

/** Swaps a refresh token for a new session, or null. */
export async function refreshMember(refreshToken: string | undefined): Promise<{ session: Session; member: Member } | null> {
  if (!refreshToken) return null;
  const { data, error } = await authClient().auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session || !data.user) return null;
  const member = await loadMember(data.user);
  return member ? { session: data.session, member } : null;
}

/** Reads both cookies from a Request (route handlers). */
export function readMemberCookies(req: Request): { access?: string; refresh?: string } {
  const out: { access?: string; refresh?: string } = {};
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === MEMBER_ACCESS_COOKIE) out.access = decodeURIComponent(v.join("="));
    if (k === MEMBER_REFRESH_COOKIE) out.refresh = decodeURIComponent(v.join("="));
  }
  return out;
}

export const isSecure = (req: Request) => new URL(req.url).protocol === "https:";

/** The signed-in member for a route handler, renewing an expired token. `fresh` = set new cookies on the response. */
export async function memberForRequest(req: Request): Promise<{ member: Member | null; fresh: Session | null }> {
  const c = readMemberCookies(req);
  const member = await memberFromToken(c.access);
  if (member) return { member, fresh: null };
  const renewed = await refreshMember(c.refresh);
  return { member: renewed?.member ?? null, fresh: renewed?.session ?? null };
}
