import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import CompareWorkspace, { type CompareItem } from "@/components/CompareWorkspace";
import { supabase } from "@/lib/supabase";
import { getComparison } from "@/lib/comparisons";
import { parseCompareScript, type CompareScript } from "@/lib/compare-script";
import { coversByScan } from "@/lib/media";
import { mediaUrl, mediaUrls } from "@/lib/storage";
import { isRenderStale } from "@/lib/render";

export const dynamic = "force-dynamic";

export default async function ComparisonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = supabase();
  const cmp = await getComparison(db, id);
  if (!cmp) notFound();

  const [{ data: scans }, { data: media }, { data: jobs }] = await Promise.all([
    db.from("scans").select("id, product_name, overall_score").in("id", cmp.scan_ids),
    db.from("scan_media").select("scan_id, kind, storage_path, sort_order, source_media_id").in("scan_id", cmp.scan_ids).in("kind", ["product_image", "label", "clip", "product_video"]),
    db.from("jobs").select("id, status, error, created_at, output").eq("comparison_id", id).eq("step", "render").order("created_at", { ascending: false }).limit(1),
  ]);
  const rows = media ?? [];
  const covers = coversByScan(rows.filter((m) => m.kind === "product_image" || m.kind === "label"));
  const thumbs = await mediaUrls([...covers.values()].map((key) => ({ bucket: "images" as const, key })), 3600);
  const items: CompareItem[] = cmp.scan_ids.map((sid, i) => {
    const s = (scans ?? []).find((x) => x.id === sid);
    const mine = rows.filter((m) => m.scan_id === sid);
    return {
      n: i + 1,
      id: sid,
      name: (s?.product_name as string | null) ?? `Product ${i + 1}`,
      score: (s?.overall_score as number | null) ?? null,
      thumb: covers.has(sid) ? (thumbs.get(covers.get(sid)!) ?? null) : null,
      videos: mine.filter((m) => (m.kind === "clip" && !m.source_media_id) || m.kind === "product_video").length,
      photos: mine.filter((m) => m.kind === "product_image").length,
    };
  });

  let script: CompareScript | null = null;
  try {
    script = cmp.script ? parseCompareScript(cmp.script, cmp.scan_ids.length) : null;
  } catch {
    script = null;
  }

  const last = jobs?.[0];
  const stale = last ? isRenderStale(last as { status: string; created_at: string; output: Record<string, unknown> | null }) : false;
  const active = last?.status === "running" && !stale ? last : undefined;
  const renderError = stale ? "The last render stopped responding. Try again." : last?.status === "failed" ? ((last.error as string | null) ?? "The last render failed.") : null;
  const slug = (cmp.title ?? "comparison").replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 60);

  return (
    <AppShell>
      <CompareWorkspace
        id={id}
        title={cmp.title ?? "Comparison"}
        items={items}
        script={script}
        forcedWinner={cmp.forced_winner}
        audioUrl={cmp.audio_path ? await mediaUrl("videos", cmp.audio_path) : null}
        durationS={cmp.duration_s !== null ? Number(cmp.duration_s) : null}
        videoUrl={cmp.video_path ? await mediaUrl("videos", cmp.video_path) : null}
        downloadUrl={cmp.video_path ? await mediaUrl("videos", cmp.video_path, 3600, `${slug}.mp4`) : null}
        renderJobId={(active?.id as string | undefined) ?? null}
        renderStartedAt={(active?.created_at as string | undefined) ?? null}
        renderProgress={(active?.output as { stage?: string; percent?: number } | null) ?? null}
        renderError={renderError}
      />
    </AppShell>
  );
}
