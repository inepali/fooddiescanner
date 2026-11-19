import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

/** POST (from the Sign out button) → clears the session and goes to the sign-in page. */
export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL("/admin", req.url), 303);
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
