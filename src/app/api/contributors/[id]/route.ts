import { supabase } from "@/lib/supabase";
import { parseContributorPatch } from "@/lib/contributors";
import { HttpError, handler, json, paramId } from "@/lib/http";

export const runtime = "nodejs";

// Admin only (behind the app sign-in, see middleware).
// { tier?: "scanner" | "creator", active?: boolean } → upgrade, downgrade, deactivate or reactivate a member.
// Inactive members are signed out on their next request and can't sign in (member-auth checks `banned`).
export const PATCH = handler(async (req, ctx) => {
  const id = await paramId(ctx);
  const patch = parseContributorPatch(await req.json().catch(() => ({})));
  if (!patch) throw new HttpError("Send a tier (scanner or creator) and/or active (true or false).");
  const { data, error } = await supabase().from("creators").update(patch).eq("id", id).select("id, tier, banned").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new HttpError("Contributor not found.", 404);
  return json({ id: data.id, tier: data.tier, active: !data.banned });
});
