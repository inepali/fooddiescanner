import { NextResponse } from "next/server";
import { clearMemberCookies } from "@/lib/member-auth";

/** POST (Log out / Sign out buttons) → clears the member cookies and goes to the home page. */
export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  clearMemberCookies(res);
  return res;
}
