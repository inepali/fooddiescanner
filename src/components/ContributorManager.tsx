"use client";

import { useMemo, useState } from "react";
import { TIER_LABEL, type Contributor, type Tier } from "@/lib/contributors";

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "never");

/** Upgrade / downgrade a member's tier, or set them inactive (can't sign in, earns nothing) and back. */
export default function ContributorManager({ initial }: { initial: Contributor[] }) {
  const [rows, setRows] = useState(initial);
  const [filter, setFilter] = useState<"all" | "active" | "inactive" | Tier>("active");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^@/, "");
    return rows.filter(
      (r) =>
        (filter === "all" || (filter === "active" ? r.active : filter === "inactive" ? !r.active : r.active && r.tier === filter)) &&
        (!q || [r.handle, r.email, r.tiktok, r.phone].some((v) => v?.toLowerCase().includes(q))),
    );
  }, [rows, filter, query]);

  async function update(id: string, body: { tier?: Tier; active?: boolean }) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/contributors/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({}))) as { error?: string; tier?: Tier; active?: boolean };
      if (!res.ok) throw new Error(data.error ?? `Saving failed (${res.status})`);
      setRows((list) => list.map((r) => (r.id === id ? { ...r, tier: data.tier ?? r.tier, active: data.active ?? r.active } : r)));
      setConfirm(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saving failed.");
    } finally {
      setBusy(null);
    }
  }

  const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-sm ${on ? "bg-accent text-white" : "bg-white text-neutral-600"}`;
  const small = "rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-medium disabled:opacity-40";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["active", "Active"],
            ["creator", "Video creators"],
            ["scanner", "Scanners"],
            ["inactive", "Inactive"],
            ["all", "All"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setFilter(id)} className={chip(filter === id)} aria-pressed={filter === id}>
            {label}
          </button>
        ))}
      </div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search name, email, TikTok or phone"
        aria-label="Search contributors"
        className="w-full rounded-xl bg-white px-3 py-2 text-sm"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {shown.length === 0 && <p className="text-neutral-500">Nobody here.</p>}

      <ul className="space-y-3">
        {shown.map((r) => (
          <li key={r.id} className={`space-y-3 rounded-2xl bg-white p-4 ${r.active ? "" : "opacity-70"}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">
                  @{r.handle ?? "?"}{" "}
                  <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-medium ${r.tier === "creator" ? "bg-indigo-100 text-indigo-800" : "bg-neutral-100 text-neutral-700"}`}>
                    {TIER_LABEL[r.tier]}
                  </span>
                  {!r.active && <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Inactive</span>}
                </p>
                <p className="truncate text-sm text-neutral-500">{r.email ?? "no email"}</p>
                <p className="text-sm text-neutral-500">
                  {r.tiktok ? (
                    <a href={`https://www.tiktok.com/@${r.tiktok}`} target="_blank" rel="noreferrer" className="text-accent">
                      TikTok @{r.tiktok}
                    </a>
                  ) : (
                    "no TikTok"
                  )}
                  {" · "}
                  {r.phone ?? "no phone"}
                </p>
              </div>
              <p className="text-right text-2xl font-bold tabular-nums">
                {r.points.toLocaleString("en-US")}
                <span className="block text-xs font-normal text-neutral-500">points</span>
              </p>
            </div>
            <p className="text-xs text-neutral-500">
              {r.scans} scans · {r.videos} videos{r.pending ? ` · ${r.pending} waiting` : ""} · last sent {day(r.lastSubmitted)} · joined {day(r.joined)}
            </p>
            <div className="flex flex-wrap gap-2">
              {r.tier === "scanner" ? (
                <button type="button" className={small} disabled={busy !== null || !r.active} onClick={() => update(r.id, { tier: "creator" })}>
                  {busy === r.id ? "Saving…" : "Upgrade to video creator"}
                </button>
              ) : (
                <button type="button" className={small} disabled={busy !== null || !r.active} onClick={() => update(r.id, { tier: "scanner" })}>
                  {busy === r.id ? "Saving…" : "Downgrade to scanner"}
                </button>
              )}
              {r.active ? (
                confirm === r.id ? (
                  <>
                    <button type="button" className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40" disabled={busy !== null} onClick={() => update(r.id, { active: false })}>
                      Yes, make inactive
                    </button>
                    <button type="button" className={small} onClick={() => setConfirm(null)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button type="button" className={`${small} text-red-700`} disabled={busy !== null} onClick={() => setConfirm(r.id)}>
                    Make inactive
                  </button>
                )
              ) : (
                <button type="button" className={small} disabled={busy !== null} onClick={() => update(r.id, { active: true })}>
                  {busy === r.id ? "Saving…" : "Reactivate"}
                </button>
              )}
            </div>
            {confirm === r.id && (
              <p className="text-xs text-neutral-500">They&apos;ll be signed out, can&apos;t sign in, and nothing they send earns points. Their past points and scans stay. You can reactivate anytime.</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
