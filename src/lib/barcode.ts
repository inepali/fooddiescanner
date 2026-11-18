import type { SupabaseClient } from "@supabase/supabase-js";
import { HttpError } from "./http.ts";
import { fetchByBarcode, isValidBarcode } from "./openfoodfacts.ts";

export type BarcodeResult = { barcode: string; name: string | null; brands: string | null; ingredients: string };

/**
 * Looks a barcode up on Open Food Facts and, if it has an ingredient list, saves it on the scan
 * (off_code + off_ingredients) so analysis can use it instead of a label photo. Fills the product
 * name if the scan doesn't have one yet. Shared by the admin and member scanners.
 */
export async function saveBarcode(db: SupabaseClient, scanId: string, raw: unknown, currentName: string | null): Promise<BarcodeResult> {
  const code = typeof raw === "string" ? raw.replace(/\D/g, "") : "";
  if (!isValidBarcode(code)) {
    throw new HttpError("That doesn't look like a valid barcode. Check the digits under the bars (8, 12 or 13 digits).");
  }
  const found = await fetchByBarcode(code);
  if (!found) throw new HttpError("Open Food Facts doesn't know this product yet. Photograph the ingredient label instead.", 404);
  if (!found.ingredientsText) {
    throw new HttpError(`Found "${found.summary.name ?? code}" but it has no ingredient list on Open Food Facts. Photograph the label instead.`, 422);
  }
  const name = found.summary.name ? [found.summary.brands?.split(",")[0]?.trim(), found.summary.name].filter(Boolean).join(" ") : null;
  const { error } = await db
    .from("scans")
    .update({ off_code: code, off_ingredients: found.ingredientsText, ...(name && !currentName ? { product_name: name } : {}) })
    .eq("id", scanId);
  if (error) throw new Error(error.message);
  return { barcode: code, name: found.summary.name, brands: found.summary.brands, ingredients: found.ingredientsText };
}
