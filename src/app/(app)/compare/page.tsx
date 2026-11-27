import Link from "next/link";
import AppShell from "@/components/AppShell";
import LargeTitle from "@/components/LargeTitle";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function ComparisonsPage() {
  const { data, error } = await supabase()
    .from("comparisons")
    .select("id, title, scan_ids, script, audio_path, video_path, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Could not load comparisons: ${error.message}`);
  const rows = data ?? [];
  const step = (r: (typeof rows)[number]) => (r.video_path ? "Video ready" : r.audio_path ? "Voice ready" : r.script ? "Script ready" : "Not started");

  return (
    <AppShell>
      <div className="space-y-5">
        <LargeTitle title="Comparisons" subtitle="Head-to-head videos of 2 to 4 scanned products." />
        <Link href="/compare/new" className="block rounded-xl bg-accent px-4 py-3 text-center font-semibold text-white">
          + New comparison
        </Link>
        {rows.length === 0 ? (
          <p className="text-neutral-600">No comparisons yet.</p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-2xl bg-white">
            {rows.map((r) => (
              <li key={r.id as string}>
                <Link href={`/compare/${r.id}`} className="flex min-h-16 items-center gap-3 px-4 py-2.5 active:bg-neutral-100">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-sm font-semibold">{(r.scan_ids as string[]).length}×</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[17px] font-medium">{(r.title as string | null) ?? "Comparison"}</span>
                    <span className="text-[13px] text-neutral-500">
                      {step(r)} · {new Date(r.created_at as string).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
