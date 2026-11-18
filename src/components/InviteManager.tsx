"use client";

import { useState } from "react";

export type Invite = { code: string; tier: "scanner" | "creator"; uses: number; max_uses: number; expires_at: string | null; created_at: string };

const select = "h-11 w-full rounded-xl border bg-[#f2f2f7] px-3 text-base";

function state(i: Invite): { label: string; live: boolean } {
  if (i.expires_at && new Date(i.expires_at) <= new Date()) return { label: "Expired", live: false };
  if (i.uses >= i.max_uses) return { label: "Used up", live: false };
  return { label: `${i.uses}/${i.max_uses} used`, live: true };
}

/** Make a code, copy or share its join link, and switch off codes you no longer want used. */
export default function InviteManager({ initial }: { initial: Invite[] }) {
  const [invites, setInvites] = useState(initial);
  const [tier, setTier] = useState<"scanner" | "creator">("scanner");
  const [uses, setUses] = useState(1);
  const [days, setDays] = useState(14);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const link = (code: string) => `${window.location.origin}/join?code=${code}`;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, max_uses: uses, days: days || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<Invite> & { error?: string };
      if (!res.ok || !data.code) throw new Error(data.error ?? "Couldn’t make a code.");
      setInvites([{ code: data.code, tier, uses: 0, max_uses: uses, expires_at: data.expires_at ?? null, created_at: new Date().toISOString() }, ...invites]);
      await share(data.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t make a code.");
    } finally {
      setBusy(false);
    }
  }

  async function share(code: string) {
    const url = link(code);
    const text = "Join me on Fooddie Scanner: scan your pantry and earn rewards.";
    try {
      if (navigator.share) {
        await navigator.share({ title: "Fooddie Scanner invite", text, url });
        return;
      }
    } catch {
      // cancelled or not allowed: fall back to copying
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 2000);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  async function revoke(code: string) {
    setError(null);
    const res = await fetch("/api/invites", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    if (!res.ok) return setError("Couldn’t switch that code off.");
    setInvites(invites.map((i) => (i.code === code ? { ...i, expires_at: new Date().toISOString() } : i)));
  }

  return (
    <div className="space-y-5">
      <form onSubmit={create} className="space-y-3 rounded-2xl bg-white p-4">
        <h2 className="font-semibold">New invite</h2>
        <div className="grid grid-cols-3 gap-2">
          <label className="space-y-1 text-sm">
            <span className="text-neutral-600">Tier</span>
            <select value={tier} onChange={(e) => setTier(e.target.value as "scanner" | "creator")} className={select}>
              <option value="scanner">Scanner</option>
              <option value="creator">Video creator</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-neutral-600">Uses</span>
            <select value={uses} onChange={(e) => setUses(Number(e.target.value))} className={select}>
              {[1, 5, 10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? "1 person" : `${n} people`}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-neutral-600">Expires</span>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={select}>
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={0}>Never</option>
            </select>
          </label>
        </div>
        <button type="submit" disabled={busy} className="h-12 w-full rounded-xl bg-accent font-semibold text-white disabled:opacity-50">
          {busy ? "Making…" : "Make invite and share"}
        </button>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </form>

      {invites.length === 0 ? (
        <p className="text-neutral-600">No invites yet.</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl bg-white">
          {invites.map((i) => {
            const s = state(i);
            return (
              <li key={i.code} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className={`font-mono text-lg font-semibold tracking-wider ${s.live ? "" : "text-neutral-400 line-through"}`}>{i.code}</p>
                  <p className="text-sm text-neutral-500">
                    {i.tier === "creator" ? "Video creator" : "Scanner"} · {s.label}
                    {s.live && i.expires_at ? ` · until ${new Date(i.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
                  </p>
                </div>
                {s.live && (
                  <>
                    <button type="button" onClick={() => share(i.code)} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-accent">
                      {copied === i.code ? "Copied!" : "Share"}
                    </button>
                    <button type="button" onClick={() => revoke(i.code)} className="min-h-11 rounded-lg px-2 text-sm text-neutral-500">
                      Turn off
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
