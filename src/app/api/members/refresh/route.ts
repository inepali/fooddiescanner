import { NextResponse } from "next/server";
import { clearMemberCookies, isSecure, readMemberCookies, refreshMember, setMemberCookies } from "@/lib/member-auth";
import { memberNext } from "@/lib/members";

/** GET ?next=/me — pages can't set cookies, so an expired access token comes here to be renewed. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = memberNext(url.searchParams.get("next"));
  const fresh = await refreshMember(readMemberCookies(req).refresh);
  if (!fresh) {
    const res = NextResponse.redirect(new URL(`/signin?next=${encodeURIComponent(next)}`, req.url), 303);
    clearMemberCookies(res);
    return res;
  }
  const res = NextResponse.redirect(new URL(next, req.url), 303);
  setMemberCookies(res, fresh.session, isSecure(req));
  return res;
}
