import { getMedia } from "@/lib/storage";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /img/<media id> → a public scan's card photo, cached for a year everywhere (browser, Vercel's
 * CDN, the image optimizer). The bytes never change for a given id: replacing a photo makes a new
 * media row, so a new address. Only photos of public, analyzed scans are served.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=60" } });
  if (!UUID.test(id)) return notFound();

  const db = supabase();
  const { data: media } = await db
    .from("scan_media")
    .select("storage_path, kind, scan_id")
    .eq("id", id)
    .in("kind", ["product_image", "label"])
    .maybeSingle();
  if (!media) return notFound();
  const { data: scan } = await db.from("scans").select("is_public, status").eq("id", media.scan_id).maybeSingle();
  if (!scan?.is_public || scan.status !== "analyzed") return notFound();

  try {
    const bytes = await getMedia("images", media.storage_path as string);
    const ext = (media.storage_path as string).split(".").pop()?.toLowerCase() ?? "jpg";
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": TYPES[ext] ?? "image/jpeg",
        "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
      },
    });
  } catch {
    return notFound();
  }
}
