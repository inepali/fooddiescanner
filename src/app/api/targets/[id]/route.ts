import { supabase } from "@/lib/supabase";
import { parseStatus } from "@/lib/targets";
import { HttpError, handler, json, paramId } from "@/lib/http";

export const runtime = "nodejs";

// Admin only. { status } and/or { priority } → updates one product on the list.
export const PATCH = handler(async (req, ctx) => {
  const id = await paramId(ctx);
  const body = (await req.json().catch(() => ({}))) as { status?: unknown; priority?: unknown };
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status !== undefined) {
    const status = parseStatus(body.status);
    if (!status) throw new HttpError("Unknown status.");
    patch.status = status;
  }
  if (body.priority !== undefined) {
    const p = Math.round(Number(body.priority));
    if (!Number.isFinite(p)) throw new HttpError("Priority is a number from 0 to 100.");
    patch.priority = Math.min(100, Math.max(0, p));
  }
  const { error } = await supabase().from("scan_targets").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  return json({ ok: true });
});

export const DELETE = handler(async (_req, ctx) => {
  const id = await paramId(ctx);
  const { error } = await supabase().from("scan_targets").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return json({ ok: true });
});
