import AppShell from "@/components/AppShell";
import LargeTitle from "@/components/LargeTitle";
import ComparePicker, { type PickItem } from "@/components/ComparePicker";
import { supabase } from "@/lib/supabase";
import { coversByScan } from "@/lib/media";
import { mediaUrls } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Step 1 of a comparison: pick 2 to 4 analyzed scans (yours and the public library). */
export default async function NewComparisonPage() {
  const db = supabase();
  const { data, error } = await db
    .from("scans")
    .select("id, product_name, overall_score, is_public, created_at")
    .eq("status", "analyzed")
    .not("overall_score", "is", null)
    .order("created_at", { ascending: false })
    .limit(400);
  if (error) throw new Error(`Could not load scans: ${error.message}`);
  const scans = data ?? [];
  const ids = scans.map((s) => s.id as string);
  const { data: media } = ids.length
    ? await db.from("scan_media").select("scan_id, kind, storage_path, sort_order").in("scan_id", ids).in("kind", ["product_image", "label", "clip", "product_video"])
    : { data: [] as { scan_id: string; kind: string; storage_path: string; sort_order: number }[] };
  const rows = media ?? [];
  const covers = coversByScan(rows.filter((m) => m.kind !== "clip" && m.kind !== "product_video"));
  const withVideo = new Set(rows.filter((m) => m.kind === "clip" || m.kind === "product_video").map((m) => m.scan_id));
  const thumbs = await mediaUrls([...covers.values()].map((key) => ({ bucket: "images" as const, key })), 3600);

  const items: PickItem[] = scans.map((s) => ({
    id: s.id as string,
    name: (s.product_name as string | null) ?? "Scanned product",
    score: s.overall_score as number,
    isPublic: Boolean(s.is_public),
    hasVideo: withVideo.has(s.id as string),
    thumb: covers.has(s.id as string) ? (thumbs.get(covers.get(s.id as string)!) ?? null) : null,
  }));

  return (
    <AppShell>
      <div className="space-y-5">
        <LargeTitle title="New comparison" subtitle="Pick 2 to 4 scanned products. The AI writes one 3-minute script with its verdict, then the video is cut from their own footage." />
        <ComparePicker items={items} />
      </div>
    </AppShell>
  );
}
