import { adminGuarded } from "@/lib/session";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { bandFor } from "@/lib/scoring";
import type { OffSummary } from "@/lib/openfoodfacts";
import { parseScript, type VideoScript } from "@/lib/script";
import DeleteScanButton from "@/components/DeleteScanButton";
import ScoreRing from "@/components/ScoreRing";
import CoverPhoto from "@/components/CoverPhoto";
import { BAND_LABEL, IngredientList, OffCrossCheck, type BreakdownIngredient } from "@/components/ScanBreakdown";
import ProductName from "@/components/ProductName";
import ScriptSection from "@/components/ScriptSection";
import { isMock } from "@/lib/mock";
import { mediaUrl, mediaUrls, type MediaBucket } from "@/lib/storage";
import { isRenderStale } from "@/lib/render";
import type { CopyRow, MediaRow, VoiceoverRow } from "@/lib/db-types";
import NavBar from "@/components/NavBar";
import { parseReveal } from "@/lib/reveal";
import ScanWorkspace, { type StudioCopy, type StudioPost, type StudioMedia, type VoiceTake } from "@/components/ScanWorkspace";

export const dynamic = "force-dynamic";

export default async function ScanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = supabase();

  const { data: scan } = await db
    .from("scans")
    .select("id, product_name, status, overall_score, allergens, label_score, external_score, off_data, is_public")
    .eq("id", id)
    .maybeSingle();
  if (!scan) notFound();
  if (scan.status === "created") redirect(`/new/${id}`);

  if (scan.status !== "analyzed" || scan.overall_score === null) {
    return (
      <div className="space-y-4">
        <p>This scan {scan.status === "failed" ? "failed" : "is still being analyzed"}.</p>
        <Link href={`/new/${id}`} className="underline">
          {scan.status === "failed" ? "Retake the label photo and retry" : "Back to this scan's photos"}
        </Link>
      </div>
    );
  }

  const { data } = await db
    .from("scan_ingredients")
    .select("id, position, raw_name, score, band, reason, provisional")
    .eq("scan_id", id)
    .order("position");
  const ingredients = (data ?? []) as BreakdownIngredient[];

  const { data: video } = await db
    .from("videos")
    .select("id, script, audio_path, voiceover_id, video_path, duration_s")
    .eq("scan_id", id)
    .not("script", "is", null)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  let latestScript: VideoScript | null = null;
  if (video?.script) {
    try {
      latestScript = parseScript(video.script);
    } catch {
      // unreadable stored script; show the button instead
    }
  }

  // Data for the voice / clips / post copy studio below the script.
  const { data: mediaData } = await db
    .from("scan_media")
    .select("id, kind, storage_path, sort_order, source_media_id")
    .eq("scan_id", id)
    .in("kind", ["product_image", "clip"])
    .order("sort_order");
  const mediaRows = (mediaData ?? []) as Pick<
    MediaRow,
    "id" | "kind" | "storage_path" | "sort_order" | "source_media_id"
  >[];
  const { data: copyData } = await db
    .from("social_copy")
    .select("platform, title, description, hashtags")
    .eq("scan_id", id);
  const { data: settingsData } = await db.from("settings").select("score_reveal, auto_advance").eq("id", 1).maybeSingle();
  const { data: acctData } = await db.from("social_accounts").select("platform, account_name, expires_at");
  const { data: postData } = await db
    .from("social_posts")
    .select("id, platform, status, permalink, error, privacy, created_at")
    .eq("scan_id", id)
    .order("created_at", { ascending: false });

  // Photos live in the images bucket; clips and the voiceover in the videos bucket.
  const bucketFor = (kind: string): MediaBucket => (kind === "clip" ? "videos" : "images");
  const urls = await mediaUrls([
    ...mediaRows.map((m) => ({ bucket: bucketFor(m.kind), key: m.storage_path })),
    ...(video?.audio_path ? [{ bucket: "videos" as const, key: video.audio_path as string }] : []),
  ]);
  const studioMedia: StudioMedia[] = mediaRows.map((m) => ({
    id: m.id,
    kind: m.kind as "product_image" | "clip",
    url: urls.get(m.storage_path) ?? "",
    source_media_id: m.source_media_id,
    is_video: /\.(mp4|mov|webm|m4v)$/i.test(m.storage_path),
    uploaded: m.kind === "clip" && !m.source_media_id,
  }));
  // The card photo: first product photo, else the label (older scans may have neither).
  const coverRow = mediaRows.find((m) => m.kind === "product_image");
  let coverUrl = coverRow ? (urls.get(coverRow.storage_path) ?? null) : null;
  if (!coverRow) {
    const { data: labelRow } = await db.from("scan_media").select("storage_path").eq("scan_id", id).eq("kind", "label").limit(1).maybeSingle();
    if (labelRow) coverUrl = await mediaUrl("images", labelRow.storage_path as string);
  }

  const studioCopy: StudioCopy[] = ((copyData ?? []) as CopyRow[]).map((c) => ({
    platform: c.platform,
    title: c.title ?? "",
    description: c.description ?? "",
    hashtags: c.hashtags ?? [],
  }));
  const { data: renderJobs } = await db
    .from("jobs")
    .select("id, status, error, created_at, output")
    .eq("scan_id", id)
    .eq("step", "render")
    .order("created_at", { ascending: false })
    .limit(1);
  const lastRender = renderJobs?.[0];
  const renderStale = lastRender ? isRenderStale(lastRender as { status: string; created_at: string; output: Record<string, unknown> | null }) : false;
  const activeRender = lastRender?.status === "running" && !renderStale ? lastRender : undefined;
  const renderError =
    renderStale ? "The last render stopped responding. Try again." : lastRender?.status === "failed" ? ((lastRender.error as string | null) ?? "The last render failed.") : null;
  const finalPath = (video?.video_path as string | null) ?? null;
  const videoUrl = finalPath ? await mediaUrl("videos", finalPath) : null;
  const downloadUrl = finalPath
    ? await mediaUrl("videos", finalPath, 3600, `${(scan.product_name ?? "ingredient-check").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.mp4`)
    : null;
  // Every saved voice take, oldest first so "Take 1" stays Take 1.
  const { data: takeData } = await db
    .from("voiceovers")
    .select("id, video_id, voice_name, delivery, audio_path, duration_s, mock, created_at")
    .eq("scan_id", id)
    .order("created_at", { ascending: true });
  const safeName = (scan.product_name ?? "ingredient-check").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const voiceTakes: VoiceTake[] = (
    await Promise.all(
      ((takeData ?? []) as VoiceoverRow[]).map(async (t, i) => ({
        id: t.id,
        number: i + 1,
        voiceName: t.voice_name ?? "Voice",
        delivery: t.delivery,
        seconds: t.duration_s === null ? null : Number(t.duration_s),
        createdAt: t.created_at,
        url: await mediaUrl("videos", t.audio_path),
        downloadUrl: await mediaUrl(
          "videos",
          t.audio_path,
          3600,
          `${safeName}-take-${i + 1}.${t.audio_path.endsWith(".wav") ? "wav" : "mp3"}`,
        ),
        selected: t.id === video?.voiceover_id,
        usable: t.video_id === video?.id,
        mock: t.mock,
      })),
    )
  ).reverse(); // newest first on screen

  const overall: number = scan.overall_score;
  const overallBand = bandFor(overall);
  const allergens: string[] = scan.allergens ?? [];
  const off = (scan.off_data ?? null) as OffSummary | null;

  const ingredientsPanel = (
    <div className="space-y-6">
      {off && <OffCrossCheck off={off} labelScore={scan.label_score} externalScore={scan.external_score} overall={overall} />}
      <IngredientList ingredients={ingredients} />
    </div>
  );

  return (
    <div className="space-y-6" data-wide>
      <NavBar title={scan.product_name ?? "Scan"} />

      <header className="flex items-center gap-5 rounded-2xl bg-white p-4 md:gap-6 md:bg-transparent md:p-0">
        <ScoreRing score={overall} />
        <div className="space-y-1">
          <ProductName scanId={id} initial={scan.product_name} />
          <p className="text-neutral-600">
            Overall: <strong>{BAND_LABEL[overallBand]}</strong> ({overall}/100)
          </p>
          {allergens.length > 0 && (
            <p className="text-sm text-neutral-500">Contains: {allergens.join(", ")}</p>
          )}
        </div>
      </header>

      <CoverPhoto scanId={id} url={coverUrl} isLabel={!coverRow && coverUrl !== null} />

      <ScanWorkspace
        ingredients={ingredientsPanel}
        scriptPanel={<ScriptSection scanId={id} initial={latestScript} />}
        scanId={id}
        media={studioMedia}
        hasScript={latestScript !== null}
        audioUrl={video?.audio_path ? (urls.get(video.audio_path as string) ?? null) : null}
        audioSeconds={video?.duration_s ?? null}
        voiceTakes={voiceTakes}
        videoUrl={videoUrl}
        downloadUrl={downloadUrl}
        renderJobId={(activeRender?.id as string | undefined) ?? null}
        renderError={renderError}
        renderStartedAt={(activeRender?.created_at as string | undefined) ?? null}
        renderProgress={(activeRender?.output as { stage?: string; percent?: number } | null | undefined) ?? null}
        copy={studioCopy}
        social={{
          guarded: adminGuarded(),
          isPublic: Boolean(scan.is_public),
          accounts: ((acctData ?? []) as { platform: "tiktok" | "instagram" | "youtube"; account_name: string | null; expires_at: string | null }[]).map((a) => ({
            platform: a.platform,
            name: a.account_name,
            expired: a.expires_at ? new Date(a.expires_at).getTime() < Date.now() : false,
          })),
          posts: ((postData ?? []) as StudioPost[]),
        }}
        mock={isMock()}
        scoreReveal={parseReveal(settingsData?.score_reveal)}
        autoAdvance={settingsData?.auto_advance === true}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-neutral-400">Scores are a general nutrition rubric, not medical advice.</p>
        <DeleteScanButton scanId={id} name={scan.product_name} after="history" />
      </div>
    </div>
  );
}
