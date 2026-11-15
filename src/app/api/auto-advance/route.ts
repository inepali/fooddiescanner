import { supabase } from "@/lib/supabase";
import { HttpError, handler, json } from "@/lib/http";

export const runtime = "nodejs";

// The "Auto-advance steps" switch.
export const PUT = handler(async (req) => {
  const body = (await req.json().catch(() => null)) as { enabled?: unknown } | null;
  if (!body || typeof body.enabled !== "boolean") throw new HttpError("Send { enabled: true | false }.");
  const { error } = await supabase().from("settings").upsert({ id: 1, auto_advance: body.enabled });
  if (error) throw new Error(`Saving the switch failed: ${error.message}`);
  return json({ enabled: body.enabled });
});
