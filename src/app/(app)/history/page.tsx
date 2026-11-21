import Link from "next/link";
import LargeTitle from "@/components/LargeTitle";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import DeleteScanButton from "@/components/DeleteScanButton";
import { bandFor, type Band } from "@/lib/scoring";
import { coversByScan } from "@/lib/media";
import { mediaUrls } from "@/lib/storage";

export const dynamic = "force-dynamic";

const BAND_BADGE: Record<Band, string> = {
  great: "bg-green-600",
  good: "bg-lime-500",
  fair: "bg-yellow-400",
  poor: "bg-orange-500",
  avoid: "bg-red-600",
};
const BAND_LABEL: Record<Band, string> = {
  great: "Great",
  good: "Good",
  fair: "Fair",
  poor: "Low",
  avoid: "Very low",
};

const REVIEW_TAG: Record<string, { text: string; cls: string }> = {
  pending: { text: "Waiting for review", cls: "bg-amber-100 text-amber-800" },
  approved: { text: "Accepted", cls: "bg-green-100 text-green-800" },
  rejected: { text: "Rejected", cls: "bg-red-100 text-red-700" },
};

type ScanRow = {
  id: string;
  product_name: string | null;
  overall_score: number | null;
  status: string;
  created_at: string;
  submitted_at: string | null;
  review_status: "pending" | "approved" | "rejected" | null;
  submission_kind: "scan" | "video" | null;
  creator_id: string | null;
  is_public: boolean;
};

type Props = { searchParams: Promise<{ show?: string }> };

/** Your own scans plus every member scan and video (even ones not read yet), newest first. */
export default async function HistoryPage({ searchParams }: Props) {
  const show = (await searchParams).show;
  const waitingOnly = show === "waiting";
  const needsPhotoOnly = show === "photo";
  const db = supabase();
  let q = db
    .from("scans")
    .select("id, product_name, overall_score, status, created_at, submitted_at, review_status, submission_kind, creator_id, is_public")
    .or("and(status.eq.analyzed,overall_score.not.is.null),submitted_at.not.is.null")
    .order("created_at", { ascending: false })
    .limit(200);
  if (waitingOnly) q = q.eq("review_status", "pending");
  // Counts over every analyzed scan (not just the 200 listed). Public = in the public library.
  const analyzedCount = () => db.from("scans").select("id", { count: "exact", head: true }).eq("status", "analyzed").not("overall_score", "is", null);
  const [{ data, error }, { count: waiting }, { count: totalCount }, { count: publicCount }] = await Promise.all([
    q,
    db.from("scans").select("id", { count: "exact", head: true }).eq("review_status", "pending"),
    analyzedCount(),
    analyzedCount().eq("is_public", true),
  ]);
  const total = totalCount ?? 0;
  const publicScans = publicCount ?? 0;
  if (error) throw new Error(`Could not load history: ${error.message}`);
  const scans = (data ?? []) as ScanRow[];

  // Who sent each member submission, every scan's card photo, and which ones came with a video.
  const allIds = scans.map((s) => s.id);
  const memberRows = scans.filter((s) => s.creator_id);
  const creatorIds = [...new Set(memberRows.map((s) => s.creator_id as string))];
  const [{ data: creators }, { data: media }] = await Promise.all([
    creatorIds.length
      ? db.from("creators").select("id, handle").in("id", creatorIds)
      : Promise.resolve({ data: [] as { id: string; handle: string | null }[] }),
    allIds.length
      ? db
          .from("scan_media")
          .select("scan_id, kind, storage_path, sort_order")
          .in("scan_id", allIds)
          .in("kind", ["product_image", "label", "product_video"])
      : Promise.resolve({ data: [] as { scan_id: string; kind: string; storage_path: string; sort_order: number }[] }),
  ]);
  const handle = new Map((creators ?? []).map((c) => [c.id, c.handle]));
  const hasVideo = new Set((media ?? []).filter((m) => m.kind === "product_video").map((m) => m.scan_id));
  const photoKey = coversByScan(media ?? []);
  const noPhoto = scans.filter((s) => !photoKey.has(s.id)).length;
  const listed = needsPhotoOnly ? scans.filter((s) => !photoKey.has(s.id)) : scans;
  const thumbs = await mediaUrls(
    listed.filter((s) => photoKey.has(s.id)).map((s) => ({ bucket: "images" as const, key: photoKey.get(s.id)! })),
    3600,
  );

  const scored = scans.filter((s) => s.status === "analyzed" && s.overall_score !== null);
  const average = scored.length ? Math.round(scored.reduce((sum, s) => sum + (s.overall_score as number), 0) / scored.length) : null;

  const tab = (active: boolean) => `rounded-full px-4 py-2 text-sm font-medium ${active ? "bg-accent text-white" : "bg-white text-neutral-600"}`;

  return (
    <AppShell>
      <div className="space-y-6">
        <LargeTitle
          title="History"
          subtitle={
            average !== null ? (
              <>
                {scored.length} {scored.length === 1 ? "scan" : "scans"} · average score <strong className="text-neutral-700">{average}</strong>/100
              </>
            ) : undefined
          }
        />

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Scans", value: total },
            { label: "Public", value: publicScans },
            { label: "Private", value: total - publicScans },
          ].map((c) => (
            <div key={c.label} className="rounded-2xl bg-white px-4 py-3">
              <p className="text-[13px] text-neutral-500">{c.label}</p>
              <p className="text-2xl font-semibold tabular-nums">{c.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/history" className={tab(!waitingOnly && !needsPhotoOnly)} aria-current={!waitingOnly && !needsPhotoOnly ? "page" : undefined}>
            All
          </Link>
          <Link href="/history?show=waiting" className={tab(waitingOnly)} aria-current={waitingOnly ? "page" : undefined}>
            Waiting for review{waiting ? ` (${waiting})` : ""}
          </Link>
          {(noPhoto > 0 || needsPhotoOnly) && (
            <Link href="/history?show=photo" className={tab(needsPhotoOnly)} aria-current={needsPhotoOnly ? "page" : undefined}>
              Needs photo{noPhoto ? ` (${noPhoto})` : ""}
            </Link>
          )}
        </div>

        {listed.length === 0 ? (
          <p className="text-neutral-600">
            {waitingOnly ? "Nothing waiting for review. 🎉" : needsPhotoOnly ? "Every scan has a photo. 🎉" : "No scans yet. Scan a label to see it here."}
          </p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-2xl bg-white">
            {listed.map((s) => {
              const analyzed = s.status === "analyzed" && s.overall_score !== null;
              const band = analyzed ? bandFor(s.overall_score as number) : null;
              const tag = s.review_status ? REVIEW_TAG[s.review_status] : null;
              const isVideo = s.submission_kind === "video";
              const thumb = photoKey.has(s.id) ? thumbs.get(photoKey.get(s.id)!) : undefined;
              // Not read yet (a video submission): open the builder to add the label or barcode.
              const href = analyzed ? `/scans/${s.id}` : `/new/${s.id}`;
              const when = new Date(s.submitted_at ?? s.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
              return (
                <li key={s.id} className="flex items-center gap-1 pr-2">
                  <Link href={href} className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 py-2.5 active:bg-neutral-100">
                    {band ? (
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums text-white ${BAND_BADGE[band]}`}>
                        {s.overall_score}
                      </span>
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-lg" aria-hidden>
                        {isVideo ? "🎬" : "…"}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[17px] font-medium">{s.product_name ?? "Scanned product"}</span>
                      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-neutral-500">
                        {tag && <span className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ${tag.cls}`}>{tag.text}</span>}
                        {analyzed &&
                          (s.is_public ? (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[12px] font-semibold text-blue-800">Public</span>
                          ) : (
                            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[12px] font-semibold text-neutral-600">Private</span>
                          ))}
                        {!photoKey.has(s.id) && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[12px] font-semibold text-red-700">No photo</span>}
                        {s.creator_id && (
                          <span>
                            {isVideo ? "Video" : "Scan"} by @{handle.get(s.creator_id) ?? "?"}
                            {!isVideo && hasVideo.has(s.id) ? " · with video" : ""} ·
                          </span>
                        )}
                        <span>
                          {band ? `${BAND_LABEL[band]} · ` : isVideo ? "Needs label · " : ""}
                          {when}
                        </span>
                      </span>
                    </span>
                    {thumb && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                    )}
                    <svg viewBox="0 0 8 14" className="h-3.5 w-2 shrink-0 text-neutral-300" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="m1 1 6 6-6 6" />
                    </svg>
                  </Link>
                  <DeleteScanButton scanId={s.id} name={s.product_name} after="refresh" />
                </li>
              );
            })}
          </ul>
        )}
        {waiting ? (
          <p className="text-sm text-neutral-500">
            Watch the videos and accept or reject on{" "}
            <Link href="/review" className="text-accent underline">
              Review
            </Link>
            .
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
