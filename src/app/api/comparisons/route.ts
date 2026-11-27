import { supabase } from "@/lib/supabase";
import { HttpError, handler, json } from "@/lib/http";
import { MAX_PRODUCTS, MIN_PRODUCTS } from "@/lib/compare-script";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Starts a comparison from 2 to 4 analyzed scans (in the order picked).
export const POST = handler(async (req) => {
  const body = (await req.json().catch(() => ({}))) as { scan_ids?: unknown };
  const ids = [...new Set(Array.isArray(body.scan_ids) ? body.scan_ids.filter((x): x is string => typeof x === "string" && UUID.test(x)) : [])];
  if (ids.length < MIN_PRODUCTS || ids.length > MAX_PRODUCTS) throw new HttpError(`Pick ${MIN_PRODUCTS} to ${MAX_PRODUCTS} products.`);

  const db = supabase();
  const { data: scans } = await db.from("scans").select("id, product_name, status, overall_score").in("id", ids);
  const ok = (scans ?? []).filter((s) => s.status === "analyzed" && s.overall_score !== null);
  if (ok.length !== ids.length) throw new HttpError("Every product must be an analyzed scan.");

  const names = ids.map((id) => ok.find((s) => s.id === id)?.product_name ?? "Product");
  const { data, error } = await db
    .from("comparisons")
    .insert({ scan_ids: ids, title: names.join(" vs ").slice(0, 100) })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Could not create the comparison: ${error?.message}`);
  return json({ id: data.id as string });
});
