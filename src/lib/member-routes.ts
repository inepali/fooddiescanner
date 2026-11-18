import { NextResponse } from "next/server";
import { HttpError, type Ctx } from "./http.ts";
import { isSecure, memberForRequest, setMemberCookies, type Member } from "./member-auth.ts";
import { supabase } from "./supabase.ts";

// Wraps a member API route: signs the member in (or 401), renews cookies if needed,
// and turns every failure into JSON like the admin routes do.
export function memberHandler(fn: (req: Request, member: Member, ctx: Ctx) => Promise<Response>) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    try {
      const { member, fresh } = await memberForRequest(req);
      if (!member) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
      const res = await fn(req, member, ctx);
      if (fresh && res instanceof NextResponse) setMemberCookies(res, fresh, isSecure(req));
      return res;
    } catch (err) {
      if (!(err instanceof HttpError)) console.error(err);
      const status = err instanceof HttpError ? err.status : 500;
      return NextResponse.json({ error: err instanceof Error ? err.message : "Unexpected server error." }, { status });
    }
  };
}

export type OwnScan = { id: string; status: string; overall_score: number | null; product_name: string | null; submitted_at: string | null };

/** The member's own scan, or 404 (never reveals other people's scans). */
export async function ownScan(member: Member, id: string): Promise<OwnScan> {
  const { data } = await supabase()
    .from("scans")
    .select("id, status, overall_score, product_name, submitted_at")
    .eq("id", id)
    .eq("creator_id", member.id)
    .maybeSingle();
  if (!data) throw new HttpError("Scan not found.", 404);
  return data as OwnScan;
}

/** Editing is only allowed before the scan is submitted. */
export function assertEditable(scan: OwnScan) {
  if (scan.submitted_at || scan.status === "analyzed" || scan.status === "analyzing") {
    throw new HttpError("This scan was already submitted.", 409);
  }
}
