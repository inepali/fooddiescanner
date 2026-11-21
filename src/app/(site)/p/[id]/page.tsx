import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { bandFor, type Band } from "@/lib/scoring";
import type { OffSummary } from "@/lib/openfoodfacts";
import Link from "next/link";
import Image from "next/image";
import ScoreRing from "@/components/ScoreRing";
import OffGrades from "@/components/site/OffGrades";
import { coverImagePath, pickCoverRow } from "@/lib/media";
import { CONTACT_EMAIL } from "@/components/LegalPage";

// Cached and rebuilt at most every 10 minutes, so crawlers and shared links don't re-render it on every visit.
// Renaming, unpublishing or deleting a scan refreshes it right away (revalidatePath in /api/scans/[id]).
export const revalidate = 600;

// No pages are built ahead of time; each report is cached the first time someone opens it.
export function generateStaticParams() {
  return [];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BAR: Record<Band, string> = {
  great: "bg-green-600",
  good: "bg-lime-500",
  fair: "bg-yellow-400",
  poor: "bg-orange-500",
  avoid: "bg-red-600",
};
const LABEL: Record<Band, string> = { great: "Great", good: "Good", fair: "Fair", poor: "Low", avoid: "Very low" };

type Ing = { position: number; raw_name: string; score: number; reason: string | null };

async function load(id: string) {
  if (!UUID.test(id)) return null;
  const db = supabase();
  const { data: scan } = await db
    .from("scans")
    .select("id, product_name, overall_score, allergens, off_data, is_public, status")
    .eq("id", id)
    .maybeSingle();
  if (!scan || !scan.is_public || scan.status !== "analyzed" || scan.overall_score == null) return null;
  const { data: ings } = await db
    .from("scan_ingredients")
    .select("position, raw_name, score, reason")
    .eq("scan_id", id)
    .order("position");
  const { data: media } = await db
    .from("scan_media")
    .select("id, kind, storage_path, sort_order")
    .eq("scan_id", id)
    .in("kind", ["product_image", "label"]);
  const rows = (media ?? []) as { id: string; kind: string; storage_path: string; sort_order: number }[];
  // The card photo first (first product photo, else the label), then any other product photos.
  const cover = pickCoverRow(rows);
  const extra = rows
    .filter((m) => m.kind === "product_image" && m.id !== cover?.id)
    .sort((a, b) => a.sort_order - b.sort_order)
    .slice(0, 4);
  const photos = [cover, ...extra].filter((m): m is (typeof rows)[number] => !!m).map((m) => coverImagePath(m.id));
  return { scan, ingredients: (ings ?? []) as Ing[], photos };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const data = await load((await params).id);
  if (!data) return { title: "Not found", robots: { index: false } };
  const name = data.scan.product_name ?? "Scanned product";
  return {
    title: `${name}: ${data.scan.overall_score}/100 ingredient score`,
    description: `Ingredient-by-ingredient label breakdown for ${name}.`,
    alternates: { canonical: `/p/${data.scan.id}` },
    openGraph: {
      title: `${name}: ${data.scan.overall_score}/100`,
      description: `Ingredient-by-ingredient label breakdown for ${name}.`,
      type: "article",
      ...(data.photos[0] ? { images: [{ url: data.photos[0], alt: name }] } : {}),
    },
  };
}

export default async function PublicScanPage({ params }: { params: Promise<{ id: string }> }) {
  const data = await load((await params).id);
  if (!data) notFound();
  const { scan, ingredients, photos } = data;
  const score = scan.overall_score as number;
  const band = bandFor(score);
  const allergens: string[] = scan.allergens ?? [];
  const off = (scan.off_data ?? null) as OffSummary | null;

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-5 pb-24 pt-4 sm:px-8">
      <Link href="/search" className="inline-flex min-h-11 items-center text-[15px] font-semibold text-[#1E6B45]">
        ← Back to the library
      </Link>
      <header className="space-y-3 rounded-3xl border border-[#E2E6DE] bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-4">
          {photos[0] && (
            <a href={photos[0]} target="_blank" rel="noreferrer" className="shrink-0" aria-label="Open the product photo">
              <Image
                src={photos[0]}
                alt={scan.product_name ?? "Product photo"}
                width={112}
                height={112}
                sizes="112px"
                priority
                className="h-24 w-24 rounded-2xl border border-[#E2E6DE] bg-[#F6F7F2] object-cover shadow-sm sm:h-28 sm:w-28"
              />
            </a>
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <h1 className="font-display text-xl font-extrabold leading-tight tracking-tight [overflow-wrap:anywhere] sm:text-3xl">
              {scan.product_name ?? "Scanned product"}
            </h1>
            <p className="text-sm text-neutral-600 sm:text-base">
              Overall: <strong>{LABEL[band]}</strong> ({score}/100) · {ingredients.length} {ingredients.length === 1 ? "ingredient" : "ingredients"}
            </p>
            {allergens.length > 0 && <p className="text-sm text-neutral-500">Contains: {allergens.join(", ")}</p>}
          </div>
          <ScoreRing score={score} className="h-20 w-20 sm:h-24 sm:w-24" />
        </div>
        {photos.length > 1 && (
          <div className="flex gap-2 overflow-x-auto">
            {photos.slice(1).map((src) => (
              <a key={src} href={src} target="_blank" rel="noreferrer" className="shrink-0" aria-label="Open photo">
                <Image src={src} alt="" width={56} height={56} sizes="56px" className="h-14 w-14 rounded-xl border border-[#E2E6DE] bg-[#F6F7F2] object-cover" />
              </a>
            ))}
          </div>
        )}
      </header>

      {off && <OffGrades off={off} />}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Ingredients, in label order</h2>
        <ol className="space-y-2">
          {ingredients.map((ing) => {
            const b = bandFor(ing.score);
            return (
              <li key={ing.position} className="rounded-2xl bg-white p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium capitalize">{ing.raw_name}</span>
                  <span className="shrink-0 text-sm tabular-nums text-neutral-600">
                    {ing.score} · {LABEL[b]}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100">
                  <div className={`h-full ${BAR[b]}`} style={{ width: `${ing.score}%` }} />
                </div>
                {ing.reason && <p className="mt-2 text-sm text-neutral-600">{ing.reason}</p>}
              </li>
            );
          })}
        </ol>
      </section>

      <footer className="space-y-1 text-xs text-neutral-500">
        <p>
          Scores are Fooddie Scanner’s opinion under a general nutrition rubric, made with AI help, for information only. Not medical
          advice or a safety rating. Based on the label as scanned; recipes and labels change, so check the package.
        </p>
        <p>
          Fooddie Scanner isn’t affiliated with or endorsed by the maker of this product. Brand names belong to their owners.{" "}
          <a className="underline" href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Correction: ${scan.product_name ?? scan.id}`)}`}>
            Report an error
          </a>
          {" · "}
          <Link className="underline" href="/terms">
            Terms
          </Link>
        </p>
        {off && (
          <p>
            Product data from{" "}
            <a className="underline" href={off.url} target="_blank" rel="noreferrer">
              Open Food Facts
            </a>{" "}
            (ODbL).
          </p>
        )}
      </footer>
    </div>
  );
}
