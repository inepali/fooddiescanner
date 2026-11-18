import { supabase } from "@/lib/supabase";
import { HttpError, handler, json, paramId } from "@/lib/http";
import { saveBarcode } from "@/lib/barcode";

export const runtime = "nodejs";
export const maxDuration = 30;

// Looks a scanned barcode up on Open Food Facts and, if it has an ingredient list,
// saves the barcode on the scan so "Analyze" can use it instead of a label photo.
export const POST = handler(async (req, ctx) => {
  const id = await paramId(ctx);
  const body = (await req.json().catch(() => ({}))) as { barcode?: unknown };
  const db = supabase();
  const { data: scan } = await db.from("scans").select("id, status, product_name").eq("id", id).maybeSingle();
  if (!scan) throw new HttpError("Scan not found.", 404);
  if (scan.status === "analyzed") throw new HttpError("This scan is already analyzed.", 409);
  return json(await saveBarcode(db, id, body.barcode, scan.product_name));
});

// The barcode already saved on this scan (the phone page and the desktop page share it).
export const GET = handler(async (_req, ctx) => {
  const id = await paramId(ctx);
  const { data } = await supabase().from("scans").select("off_code, product_name, off_ingredients").eq("id", id).maybeSingle();
  return json({ barcode: data?.off_code ?? null, name: data?.product_name ?? null, ingredients: data?.off_ingredients ?? null });
});
