import { saveBarcode } from "@/lib/barcode";
import { json, paramId } from "@/lib/http";
import { assertEditable, memberHandler, ownScan } from "@/lib/member-routes";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST { barcode } → looks the product up on Open Food Facts and saves it on the member's draft.
 * Scans: stands in for the label photo. Videos: names the product and gives the admin its
 * ingredient list, so the final video can be made without a label photo.
 */
export const POST = memberHandler(async (req, member, ctx) => {
  const scan = await ownScan(member, await paramId(ctx));
  assertEditable(scan);
  const body = (await req.json().catch(() => ({}))) as { barcode?: unknown };
  return json(await saveBarcode(supabase(), scan.id, body.barcode, scan.product_name));
});

/** DELETE → removes the barcode (wrong product). */
export const DELETE = memberHandler(async (_req, member, ctx) => {
  const scan = await ownScan(member, await paramId(ctx));
  assertEditable(scan);
  const { error } = await supabase().from("scans").update({ off_code: null, off_ingredients: null }).eq("id", scan.id);
  if (error) throw new Error(error.message);
  return json({ ok: true });
});
