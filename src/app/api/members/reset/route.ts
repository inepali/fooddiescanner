import { NextResponse } from "next/server";
import { authClient } from "@/lib/member-auth";
import { passwordProblem } from "@/lib/members";
import { supabase } from "@/lib/supabase";

/** POST { accessToken, password } → sets a new password for the account the reset link was for. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { accessToken?: unknown; password?: unknown };
  const problem = passwordProblem(body.password);
  if (problem) return NextResponse.json({ ok: false, error: problem }, { status: 400 });
  if (typeof body.accessToken !== "string" || !body.accessToken) {
    return NextResponse.json({ ok: false, error: "This reset link is missing its code. Request a new one." }, { status: 400 });
  }

  const { data, error } = await authClient().auth.getUser(body.accessToken);
  if (error || !data.user) {
    return NextResponse.json({ ok: false, error: "This reset link has expired. Request a new one." }, { status: 401 });
  }
  const { error: updateError } = await supabase().auth.admin.updateUserById(data.user.id, { password: body.password as string });
  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message || "Couldn’t save the new password." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
