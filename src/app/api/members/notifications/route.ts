import { NextResponse } from "next/server";
import { memberHandler } from "@/lib/member-routes";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

/** POST (form from /me) → marks the member's notices read, then back to /me. */
export const POST = memberHandler(async (req, member) => {
  const { error } = await supabase()
    .from("member_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("creator_id", member.id)
    .is("read_at", null);
  if (error) throw new Error(error.message);
  return NextResponse.redirect(new URL("/me", req.url), 303);
});
