"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export type PickItem = { id: string; name: string; score: number; isPublic: boolean; hasVideo: boolean; thumb: string | null };

const MAX = 4;

export default function ComparePicker({ items }: { items: PickItem[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<"all" | "public" | "video">("all");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter(
      (i) =>
        (!needle || i.name.toLowerCase().includes(needle)) &&
        (only === "all" || (only === "public" ? i.isPublic : i.hasVideo)),
    );
  }, [items, q, only]);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX ? p : [...p, id]));

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/comparisons", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scan_ids: picked }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !data.id) throw new Error(data.error ?? `Server error (HTTP ${res.status}).`);
      router.push(`/compare/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the comparison.");
      setBusy(false);
    }
  };

  const tab = (active: boolean) => `rounded-full px-4 py-2 text-sm font-medium ${active ? "bg-accent text-white" : "bg-white text-neutral-600"}`;
  const byId = new Map(items.map((i) => [i.id, i]));

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 space-y-3 rounded-2xl bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {picked.length === 0 && <p className="text-sm text-neutral-500">Nothing picked yet.</p>}
          {picked.map((id, i) => (
            <button key={id} type="button" onClick={() => toggle(id)} className="flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-sm text-accent">
              <span className="font-semibold">{i + 1}</span>
              <span className="max-w-40 truncate">{byId.get(id)?.name}</span>
              <span aria-hidden>×</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={picked.length < 2 || busy}
          onClick={create}
          className="w-full rounded-xl bg-accent px-4 py-3 font-semibold text-white disabled:opacity-40"
        >
          {busy ? "Creating…" : picked.length < 2 ? `Pick at least 2 (${picked.length}/${MAX})` : `Compare ${picked.length} products`}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search scanned products"
        className="w-full rounded-xl border bg-white px-4 py-3 text-[17px]"
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" className={tab(only === "all")} onClick={() => setOnly("all")}>All scans</button>
        <button type="button" className={tab(only === "public")} onClick={() => setOnly("public")}>Public</button>
        <button type="button" className={tab(only === "video")} onClick={() => setOnly("video")}>Has video</button>
      </div>

      {shown.length === 0 ? (
        <p className="text-neutral-600">No scans match.</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl bg-white">
          {shown.map((s) => {
            const n = picked.indexOf(s.id);
            const full = n < 0 && picked.length >= MAX;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => toggle(s.id)}
                  disabled={full}
                  aria-pressed={n >= 0}
                  className={`flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-neutral-100 disabled:opacity-40 ${n >= 0 ? "bg-accent-soft" : ""}`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${n >= 0 ? "border-accent bg-accent text-white" : "border-neutral-300 text-transparent"}`}>
                    {n >= 0 ? n + 1 : "·"}
                  </span>
                  {s.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.thumb} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="h-11 w-11 shrink-0 rounded-lg bg-neutral-100" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[17px] font-medium">{s.name}</span>
                    <span className="flex flex-wrap gap-1.5 text-[12px]">
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-semibold tabular-nums text-neutral-700">{s.score}/100</span>
                      {s.isPublic && <span className="rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-blue-800">Public</span>}
                      {s.hasVideo ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 font-semibold text-green-800">🎬 Video</span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">Photos only</span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-sm text-neutral-500">
        Past comparisons are on <Link href="/compare" className="text-accent underline">Comparisons</Link>.
      </p>
    </div>
  );
}
