import { supabase } from "@/lib/supabase";
import { cleanTarget } from "@/lib/targets";
import { HttpError, handler, json } from "@/lib/http";

export const runtime = "nodejs";

// Admin only (behind the app sign-in, see middleware). Adds a product to the products-to-scan list.
export const POST = handler(async (req) => {
  const t = cleanTarget(await req.json().catch(() => ({})));
  if (typeof t === "string") throw new HttpError(t);
  const { data, error } = await supabase()
    .from("scan_targets")
    .insert(t)
    .select("id, product, store, category, compare_group, priority, status, scan_id")
    .single();
  if (error) throw new HttpError(error.code === "23505" ? "That product is already on the list for this store." : error.message);
  return json({ target: data });
});
