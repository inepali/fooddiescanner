import { NextResponse } from "next/server";
import { clearMemberCookies } from "@/lib/member-auth";

/** POST (Sign out button) → clears the member cookies and goes to the sign-in page. */
export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL("/signin", req.url), 303);
  clearMemberCookies(res);
  return res;
}
