import Link from "next/link";
import AppShell from "@/components/AppShell";
import LargeTitle from "@/components/LargeTitle";
import ReviewActions from "@/components/ReviewActions";
import ReviewTabs from "@/components/ReviewTabs";
import { mediaUrl } from "@/lib/storage";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ show?: string }> };

type Row = {
  id: string;
  product_name: string | null;
  overall_score: number | null;
  status: string;
  review_status: "pending" | "approved" | "rejected";
  is_public: boolean;
  submitted_at: string;
  creator_id: string;
  submission_kind: "scan" | "video" | null;
};

/**
 * Member submissions, scans and videos alike: watch the video, check the photos, generate the
 * final video in the studio, then accept (the member gets a notice) or reject.
 */
export default async function ReviewPage({ searchParams }: Props) {
  const show = (await searchParams).show === "done" ? "done" : "pending";
  const db = supabase();
  let q = db
    .from("scans")
    .select("id, product_name, overall_score, status, review_status, is_public, submitted_at, creator_id, submission_kind")
    .not("creator_id", "is", null)
    .not("submitted_at", "is", null)
    .order("submitted_at", { ascending: show === "pending" })
    .limit(30);
  q = show === "pending" ? q.eq("review_status", "pending") : q.in("review_status", ["approved", "rejected"]);
  const { data, error } = await q;
  if (error) throw new Error(`Could not load submissions: ${error.message}`);
  const rows = (data ?? []) as Row[];

  const ids = rows.map((r) => r.id);
  const creatorIds = [...new Set(rows.map((r) => r.creator_id))];
  const [{ data: media }, { data: creators }, { count: pendingCount }] = await Promise.all([
    ids.length
      ? db.from("scan_media").select("scan_id, kind, storage_path, duration_s").in("scan_id", ids).in("kind", ["label", "product_image", "product_video"])
      : Promise.resolve({ data: [] as { scan_id: string; kind: string; storage_path: string; duration_s: number | null }[] }),
    creatorIds.length
      ? db.from("creators").select("id, handle, tiktok_handle, tier").in("id", creatorIds)
      : Promise.resolve({ data: [] as { id: string; handle: string | null; tiktok_handle: string | null; tier: string }[] }),
    db.from("scans").select("id", { count: "exact", head: true }).eq("review_status", "pending"),
  ]);
  const who = new Map((creators ?? []).map((c) => [c.id, c]));
  const files = new Map<string, { label?: string; product?: string; video?: string; seconds?: number | null }>();
  await Promise.all(
    (media ?? []).map(async (m) => {
      const f = files.get(m.scan_id) ?? {};
      files.set(m.scan_id, f);
      if (m.kind === "product_video") {
        f.video = await mediaUrl("videos", m.storage_path, 3600);
        f.seconds = m.duration_s;
      } else {
        const url = await mediaUrl("images", m.storage_path, 3600);
        if (m.kind === "label") f.label = url;
        else f.product = url;
      }
    }),
  );

  return (
    <AppShell>
      <div className="space-y-5">
        <LargeTitle title="Review" subtitle={`${pendingCount ?? 0} waiting`} />
        <ReviewTabs active={show} />
        {rows.length === 0 && <p className="text-neutral-600">{show === "pending" ? "Nothing to review. 🎉" : "Nothing reviewed yet."}</p>}
        {rows.map((r) => {
          const c = who.get(r.creator_id);
          const f = files.get(r.id) ?? {};
          return (
            <article key={r.id} className="space-y-3 rounded-2xl bg-white p-4">
              <header className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-neutral-400">
                    {r.submission_kind === "video" ? "Video submission" : "Scan submission"}
                  </p>
                  <h2 className="truncate text-lg font-semibold">
                    {r.status === "analyzed" ? (
                      <Link href={`/scans/${r.id}`}>{r.product_name ?? "Unnamed product"}</Link>
                    ) : r.submission_kind === "video" ? (
                      r.product_name ?? "Unnamed product"
                    ) : (
                      "Still reading…"
                    )}
                  </h2>
                  <p className="text-sm text-neutral-500">
                    @{c?.handle ?? "?"}
                    {c?.tiktok_handle ? (
                      <>
                        {" · "}
                        <a href={`https://www.tiktok.com/@${c.tiktok_handle}`} target="_blank" rel="noreferrer" className="text-accent">
                          TikTok @{c.tiktok_handle}
                        </a>
                      </>
                    ) : (
                      " · no TikTok yet"
                    )}
                    {" · "}
                    {new Date(r.submitted_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                {r.overall_score !== null && <span className="text-2xl font-bold tabular-nums">{r.overall_score}</span>}
              </header>
              {f.video && (
                <video src={f.video} controls playsInline preload="metadata" className="aspect-[9/16] max-h-[70vh] w-full rounded-xl bg-black object-contain">
                  <track kind="captions" />
                </video>
              )}
              <p className="text-sm text-neutral-500">{f.seconds ? `Video: ${Math.round(f.seconds)} s` : "No video"}</p>
              <div className="grid grid-cols-2 gap-2">
                {[f.label && { src: f.label, alt: "Ingredient label" }, f.product && { src: f.product, alt: "Product" }]
                  .filter((x): x is { src: string; alt: string } => Boolean(x))
                  .map((img) => (
                    <a key={img.alt} href={img.src} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.src} alt={img.alt} className="aspect-square w-full rounded-xl object-cover" />
                    </a>
                  ))}
              </div>
              {r.submission_kind === "video" && (
                <Link
                  href={r.status === "analyzed" ? `/scans/${r.id}` : `/new/${r.id}`}
                  className="flex h-12 items-center justify-center rounded-xl bg-neutral-100 font-semibold text-neutral-800"
                >
                  {r.status === "analyzed" ? "Generate the video →" : "Add label or barcode, then generate the video →"}
                </Link>
              )}
              <ReviewActions id={r.id} status={r.review_status} isPublic={r.is_public} />
            </article>
          );
        })}
      </div>
    </AppShell>
  );
}
