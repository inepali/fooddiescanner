"use client";

import { useCallback, useEffect, useState } from "react";

// "Best time to post": the next good TikTok and YouTube slots for this video (src/lib/post-schedule.ts).
// You post or schedule it yourself (Metricool, or "Post now"); "I scheduled it in Metricool" reserves
// the time so the next video's suggestion moves on to a later slot.

type Platform = "tiktok" | "youtube";
type Suggestion = { at: string; label: string; score: number; strength: number; recommended: boolean };
type Booking = { id: string; platform: Platform; run_at: string; status: "booked" | "canceled" };
type Data = { suggestions: Record<Platform, Suggestion[]>; bookings: Booking[] };

const LABEL: Record<Platform, string> = { tiktok: "TikTok", youtube: "YouTube" };

const fmt = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    .format(new Date(iso))
    .replace(/, (\d{1,2}:\d{2})/, " · $1") + " ET";

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : `Server error (HTTP ${res.status}).`);
  return data as T;
}

export default function PostScheduler({ scanId, videoReady, guarded }: { scanId: string; videoReady: boolean; guarded: boolean }) {
  const [data, setData] = useState<Data | null>(null);
  const [pick, setPick] = useState<Record<Platform, string | null>>({ tiktok: null, youtube: null });
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await call<Data>(`/api/scans/${scanId}/schedule`);
      setData(d);
      const first = (p: Platform) => d.suggestions[p].find((s) => s.recommended)?.at ?? d.suggestions[p][0]?.at ?? null;
      setPick({ tiktok: first("tiktok"), youtube: first("youtube") });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Couldn't load posting times.", bad: true });
    }
  }, [scanId]);

  useEffect(() => {
    if (videoReady) void load();
  }, [videoReady, load]);

  async function act(key: string, fn: () => Promise<string>, reload = true) {
    setBusy(key);
    setMsg(null);
    try {
      setMsg({ text: await fn() });
      if (reload) await load();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Something went wrong.", bad: true });
    } finally {
      setBusy(null);
    }
  }

  const book = (platform: Platform) =>
    act(`book-${platform}`, async () => {
      const at = pick[platform];
      if (!at) throw new Error("Pick a time.");
      await call(`/api/scans/${scanId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, at }),
      });
      return `Saved: ${LABEL[platform]} booked in Metricool for ${fmt(at)}.`;
    });

  const clear = (platform: Platform) =>
    act(`clear-${platform}`, async () => {
      await call(`/api/scans/${scanId}/schedule?platform=${platform}`, { method: "DELETE" });
      return `${LABEL[platform]} time cleared.`;
    });

  const copyTime = (at: string) =>
    act(
      "copy",
      async () => {
        await navigator.clipboard.writeText(fmt(at));
        return "Time copied. Paste it into Metricool's scheduler.";
      },
      false,
    );

  return (
    <section className="space-y-3 rounded-2xl bg-white p-4">
      <div>
        <h3 className="font-medium">Best time to post</h3>
        <p className="text-xs text-neutral-500">From your Metricool audience data (Eastern time). Wed and Thu are strongest; weekends are about half.</p>
      </div>

      {!videoReady && <p className="text-sm text-neutral-500">Render the final video and the next best times show up here.</p>}
      {videoReady && !data && !msg && <p className="text-sm text-neutral-500">Finding the next best times…</p>}

      {videoReady &&
        data &&
        (["tiktok", "youtube"] as const).map((platform) => {
          const booked = data.bookings.find((b) => b.platform === platform);
          const options = data.suggestions[platform];
          return (
            <div key={platform} className="space-y-2 rounded-xl bg-neutral-50 p-3 text-sm">
              <strong>{LABEL[platform]}</strong>

              {booked ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-neutral-700">Booked in Metricool for {fmt(booked.run_at)}.</p>
                  <button className="text-xs underline disabled:opacity-40" disabled={busy !== null || !guarded} onClick={() => clear(platform)}>
                    Clear
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`${LABEL[platform]} time`}>
                    {options.map((s) => (
                      <button
                        key={s.at}
                        role="radio"
                        aria-checked={pick[platform] === s.at}
                        onClick={() => setPick((p) => ({ ...p, [platform]: s.at }))}
                        className={`rounded-xl px-3 py-1.5 text-left text-xs ${pick[platform] === s.at ? "bg-accent text-white" : "bg-white text-neutral-800"}`}
                      >
                        <span className="block font-medium">{s.label}</span>
                        <span className={pick[platform] === s.at ? "text-white/80" : "text-neutral-500"}>
                          {s.recommended ? "★ best · " : ""}
                          {s.strength}% of peak
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded-xl bg-neutral-200 px-3 py-1.5 text-xs disabled:opacity-40"
                      disabled={busy !== null || !pick[platform]}
                      onClick={() => pick[platform] && copyTime(pick[platform])}
                    >
                      Copy time
                    </button>
                    <button
                      className="rounded-xl bg-neutral-200 px-3 py-1.5 text-xs disabled:opacity-40"
                      disabled={busy !== null || !pick[platform] || !guarded}
                      onClick={() => book(platform)}
                    >
                      {busy === `book-${platform}` ? "Saving…" : "I scheduled it in Metricool"}
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}

      {msg && <p className={`text-xs ${msg.bad ? "text-red-700" : "text-green-700"}`}>{msg.text}</p>}
    </section>
  );
}
