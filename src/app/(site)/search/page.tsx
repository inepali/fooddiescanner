import type { Metadata } from "next";
import SearchBar from "@/components/site/SearchBar";
import ScanCard from "@/components/site/ScanCard";
import { supabase } from "@/lib/supabase";
import { orEmpty, recentScans, searchScans } from "@/lib/library";

type Props = { searchParams: Promise<{ q?: string | string[] }> };

const readQ = (q: string | string[] | undefined) => (Array.isArray(q) ? q[0] : q ?? "").trim().slice(0, 100);

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = readQ((await searchParams).q);
  return {
    title: q ? `“${q}” — search` : "Search all scans",
    // Result pages are endless variations; let search engines index the products themselves instead.
    robots: q ? { index: false, follow: true } : undefined,
  };
}

export default async function SearchPage({ searchParams }: Props) {
  const q = readQ((await searchParams).q);
  const results = await orEmpty(() => (q ? searchScans(supabase(), q) : recentScans(supabase(), 60)), []);

  return (
    <div className="mx-auto max-w-6xl px-5 pb-24 pt-8 sm:px-8">
      <div className="flex flex-col items-center gap-6 pb-12 text-center">
        <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">{q ? "Search the library" : "All scans"}</h1>
        <SearchBar defaultValue={q} autoFocus={!q} />
      </div>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-2xl font-bold" aria-live="polite">
          {q ? `${results.length} ${results.length === 1 ? "result" : "results"} for “${q}”` : `${results.length} products, newest first`}
        </h2>
      </div>

      {results.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {results.map((s) => (
            <ScanCard key={s.id} scan={s} />
          ))}
        </div>
      ) : (
        <div className="space-y-2 rounded-[20px] border-[1.5px] border-dashed border-[#C99A00] bg-[#FFF8E1] p-8">
          <p className="font-display text-2xl font-bold">We haven’t scanned that yet.</p>
          <p className="text-base text-[#3C4A42]">Try a brand name, a single ingredient (like “sugar” or “red 40”), or the barcode number on the package.</p>
        </div>
      )}
    </div>
  );
}
