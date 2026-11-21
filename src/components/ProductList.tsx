"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { STORES, TARGET_STATUSES, type Target, type TargetStatus } from "@/lib/targets";

const CHIP: Record<TargetStatus, string> = {
  next: "bg-amber-100 text-amber-800",
  todo: "bg-neutral-100 text-neutral-700",
  scanned: "bg-green-100 text-green-800",
  skipped: "bg-neutral-100 text-neutral-400 line-through",
};

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { error?: string; target?: Target };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

/**
 * The products-to-scan list: filter by store and status, group by rival products ("compare
 * group"), and mark items Wanted next (members see those), Scanned or Skipped.
 */
export default function ProductList({ initial }: { initial: Target[] }) {
  const [rows, setRows] = useState(initial);
  const [store, setStore] = useState("all");
  const [status, setStatus] = useState<"open" | TargetStatus | "all">("open");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ product: "", store: "Costco", category: "", compare_group: "", priority: "70" });

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (store === "all" || r.store === store) &&
        (status === "all" || (status === "open" ? r.status === "todo" || r.status === "next" : r.status === status)) &&
        (!q || `${r.product} ${r.category} ${r.compare_group ?? ""}`.toLowerCase().includes(q)),
    );
  }, [rows, store, status, query]);

  // Rivals together: each compare group (or category) is one block, best priority first.
  const groups = useMemo(() => {
    const map = new Map<string, Target[]>();
    for (const r of shown) {
      const key = r.compare_group ?? r.category;
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return [...map.entries()].sort((a, b) => Math.max(...b[1].map((r) => r.priority)) - Math.max(...a[1].map((r) => r.priority)));
  }, [shown]);

  async function setStatusOf(id: string, next: TargetStatus) {
    setError(null);
    const before = rows;
    setRows((list) => list.map((r) => (r.id === id ? { ...r, status: next } : r)));
    try {
      await send(`/api/targets/${id}`, "PATCH", { status: next });
    } catch (e) {
      setRows(before);
      setError(e instanceof Error ? e.message : "Saving failed.");
    }
  }
  async function remove(id: string) {
    setError(null);
    try {
      await send(`/api/targets/${id}`, "DELETE");
      setRows((list) => list.filter((r) => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    }
  }
  async function add() {
    setError(null);
    try {
      const { target } = await send("/api/targets", "POST", { ...form, priority: Number(form.priority) });
      if (target) setRows((list) => [target, ...list]);
      setForm((f) => ({ ...f, product: "" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Adding failed.");
    }
  }

  const wanted = rows.filter((r) => r.status === "next").length;
  const input = "rounded-xl bg-neutral-100 px-2 py-2 text-sm";

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-500">
        {wanted} marked <strong>Wanted next</strong>: members see the top 5 on their rewards page, and new scripts pick tomorrow&apos;s scan from this list
        (rivals of the product first).
      </p>
      <div className="flex flex-wrap gap-2">
        <select value={store} onChange={(e) => setStore(e.target.value)} aria-label="Store" className={input}>
          <option value="all">All stores</option>
          {STORES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Status" className={input}>
          <option value="open">Not scanned yet</option>
          {TARGET_STATUSES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
          <option value="all">Everything</option>
        </select>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search" className={`${input} min-w-[10rem] flex-1`} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {groups.map(([key, items]) => (
        <section key={key} className="space-y-2 rounded-2xl bg-white p-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            {key.replace(/-/g, " ")} {items.length > 1 ? `· compare ${items.length}` : ""}
          </h2>
          <ul className="divide-y">
            {items.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{r.scan_id ? <Link href={`/scans/${r.scan_id}`}>{r.product}</Link> : r.product}</p>
                  <p className="text-xs text-neutral-500">
                    {r.store} · {r.category} · priority {r.priority}
                  </p>
                </div>
                <select
                  value={r.status}
                  onChange={(e) => setStatusOf(r.id, e.target.value as TargetStatus)}
                  aria-label={`Status of ${r.product}`}
                  className={`rounded-full px-2 py-1 text-xs font-medium ${CHIP[r.status]}`}
                >
                  {TARGET_STATUSES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => remove(r.id)} className="text-xs text-red-600 underline">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {groups.length === 0 && <p className="text-neutral-500">Nothing matches.</p>}

      <section className="space-y-2 rounded-2xl bg-white p-3">
        <h2 className="font-medium">Add a product</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} placeholder="Product (brand + name)" className={input} />
          <select value={form.store} onChange={(e) => setForm({ ...form, store: e.target.value })} aria-label="Store" className={input}>
            {STORES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Category (e.g. Cereal)" className={input} />
          <input
            value={form.compare_group}
            onChange={(e) => setForm({ ...form, compare_group: e.target.value })}
            placeholder="Compare group (e.g. peanut-butter)"
            className={input}
          />
          <input
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
            inputMode="numeric"
            aria-label="Priority 0-100"
            placeholder="Priority 0-100"
            className={input}
          />
          <button type="button" onClick={add} disabled={form.product.trim().length < 2} className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
            Add
          </button>
        </div>
      </section>
    </div>
  );
}
