import { NextResponse } from "next/server";
import { analyzeScan } from "@/lib/analyze-scan";
import { HttpError, json, paramId } from "@/lib/http";
import { memberHandler, ownScan } from "@/lib/member-routes";
import { PARTS, dailySubmitLimit, missingParts, nextSubmitAt, waitText } from "@/lib/member-scan";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

/** POST → checks all three parts are in, reads the label and scores it. Points land when it's analyzed. */
export const POST = memberHandler(async (_req, member, ctx) => {
  const scan = await ownScan(member, await paramId(ctx));
  if (scan.status === "analyzed") return json({ id: scan.id });
  if (scan.status === "analyzing") throw new HttpError("Still reading your label. Give it a moment.", 409);

  const db = supabase();
  const { data: media } = await db.from("scan_media").select("kind").eq("scan_id", scan.id);
  const missing = missingParts((media ?? []).map((m) => m.kind as string));
  if (missing.length) {
    const names = missing.map((m) => PARTS.find((p) => p.id === m)!.label.toLowerCase()).join(", ");
    throw new HttpError(`Add your ${names} first.`);
  }

  if (!scan.submitted_at) {
    const { data: recent } = await db
      .from("scans")
      .select("submitted_at")
      .eq("creator_id", member.id)
      .neq("id", scan.id)
      .gte("submitted_at", new Date(Date.now() - 86_400_000).toISOString());
    const limit = dailySubmitLimit();
    const until = nextSubmitAt((recent ?? []).map((r) => Date.parse(r.submitted_at as string)), limit);
    if (until) {
      const what = limit === 1 ? "one scan" : `${limit} scans`;
      throw new HttpError(`You can submit ${what} every 24 hours. Your next one opens ${waitText(until)}. Your draft is saved.`, 429);
    }
    await db.from("scans").update({ submitted_at: new Date().toISOString(), review_status: "pending" }).eq("id", scan.id);
  }
  const res = await analyzeScan(scan.id);
  if (!res.ok) {
    // A failed read (blurry label) can be retried with a new photo: reopen the draft.
    await db.from("scans").update({ submitted_at: null, review_status: null, status: "created" }).eq("id", scan.id);
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return NextResponse.json({ error: body.error ?? "Couldn’t read that label." }, { status: res.status });
  }
  return json({ id: scan.id });
});
