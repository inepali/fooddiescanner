"use client";

import { useCallback, useEffect, useState } from "react";

// "Best time to post": the next good TikTok and YouTube slots for this video (src/lib/post-schedule.ts).
// Connected account → book it and the app posts it on time (/api/cron/publish, every 10 min).
// Not connected yet → schedule that time in Metricool, then mark it here so the next video gets the next slot.

type Platform = "tiktok" | "youtube";
type Suggestion = { at: string; label: string; score: number; strength: number; recommended: boolean };
type Booking = {
  id: string;
  platform: Platform;
  run_at: string;
  via: "app" | "metricool";
  status: "scheduled" | "posting" | "posted" | "failed" | "missed" | "canceled" | "external";
  error: string | null;
};
type Data = { suggestions: Record<Platform, Suggestion[]>; bookings: Booking[]; connected: Record<Platform, boolean> };

const LABEL: Record<Platform, string> = { tiktok: "TikTok", youtube: "YouTube" };
const LIVE = ["scheduled", "posting", "external"];

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

export default function PostScheduler(props: {
  scanId: string;
  videoReady: boolean;
  hasCopy: boolean;
  guarded: boolean;
  /** Same settings as "Post now", so a scheduled post goes out the way you'd post it by hand. */
  tiktokPrivacy: string;
  youtubePrivacy: string;
  coverSeconds: number;
}) {
  const { scanId, videoReady, hasCopy, guarded } = props;
  const [data, setData] = useState<Data | null>(null);
  const [pick, setPick] = useState<Record<Platform, string | null>>({ tiktok: null, youtube: null });
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await call<Data>(`/api/scans/${scanId}/schedule`);
      setData(d);
      setPick({
        tiktok: d.suggestions.tiktok.find((s) => s.recommended)?.at ?? d.suggestions.tiktok[0]?.at ?? null,
        youtube: d.suggestions.youtube.find((s) => s.recommended)?.at ?? d.suggestions.youtube[0]?.at ?? null,
      });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Couldn't load posting times.", bad: true });
    }
  }, [scanId]);

  useEffect(() => {
    if (videoReady) void load();
  }, [videoReady, load]);

  // While a booking is due soon or posting, refresh now and then so the status updates.
  const live = data?.bookings.some((b) => b.status === "posting" || (b.status === "scheduled" && new Date(b.run_at).getTime() - Date.now() < 15 * 60_000));
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => void load(), 60_000);
    return () => clearInterval(t);
  }, [live, load]);

  async function act(key: string, fn: () => Promise<string>) {
    setBusy(key);
    setMsg(null);
    try {
      setMsg({ text: await fn() });
      await load();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Something went wrong.", bad: true });
    } finally {
      setBusy(null);
    }
  }

  const book = (platform: Platform, via: "app" | "metricool") =>
    act(`${via}-${platform}`, async () => {
      const at = pick[platform];
      if (!at) throw new Error("Pick a time.");
      await call(`/api/scans/${scanId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          at,
          via,
          privacy: platform === "tiktok" ? props.tiktokPrivacy : props.youtubePrivacy,
          cover_seconds: props.coverSeconds,
        }),
      });
      return via === "app" ? `${LABEL[platform]} post scheduled for ${fmt(at)}.` : `Marked as scheduled in Metricool for ${fmt(at)}.`;
    });

  const cancel = (platform: Platform) =>
    act(`cancel-${platform}`, async () => {
      await call(`/api/scans/${scanId}/schedule?platform=${platform}`, { method: "DELETE" });
      return `${LABEL[platform]} booking canceled.`;
    });

  const copyTime = (at: string) =>
    act("copy", async () => {
      await navigator.clipboard.writeText(fmt(at));
      return "Time copied. Paste it into Metricool's scheduler.";
    });

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
          const bookings = data.bookings.filter((b) => b.platform === platform);
          const current = bookings.find((b) => LIVE.includes(b.status));
          const last = bookings[0];
          const connected = data.connected[platform];
          const options = data.suggestions[platform];
          return (
            <div key={platform} className="space-y-2 rounded-xl bg-neutral-50 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <strong>{LABEL[platform]}</strong>
                <span className="text-xs text-neutral-500">{connected ? "auto-posts when booked" : "not connected · use Metricool"}</span>
              </div>

              {current ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={current.status === "external" ? "text-neutral-700" : "text-green-700"}>
                    {current.status === "posting" && `Posting now (booked for ${fmt(current.run_at)})…`}
                    {current.status === "scheduled" && `Scheduled: the app posts it ${fmt(current.run_at)}.`}
                    {current.status === "external" && `Booked in Metricool for ${fmt(current.run_at)}.`}
                  </p>
                  {current.status !== "posting" && (
                    <button className="text-xs underline disabled:opacity-40" disabled={busy !== null} onClick={() => cancel(platform)}>
                      Cancel
                    </button>
                  )}
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

                  {connected ? (
                    <button
                      className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                      disabled={busy !== null || !pick[platform] || !hasCopy || !guarded}
                      onClick={() => book(platform, "app")}
                    >
                      {busy === `app-${platform}` ? "Scheduling…" : `Schedule ${LABEL[platform]} post`}
                    </button>
                  ) : (
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
                        onClick={() => book(platform, "metricool")}
                      >
                        {busy === `metricool-${platform}` ? "Saving…" : "I scheduled it in Metricool"}
                      </button>
                    </div>
                  )}
                  {connected && !hasCopy && <p className="text-xs text-neutral-500">Generate the social copy first.</p>}
                  {platform === "tiktok" && connected && (
                    <p className="text-xs text-neutral-500">Uses the &quot;Who can see it&quot; and cover settings below.</p>
                  )}
                </>
              )}

              {!current && last && (last.status === "failed" || last.status === "missed") && (
                <p className="text-xs text-red-700">
                  Last booking ({fmt(last.run_at)}) {last.status === "missed" ? "was missed" : "failed"}: {last.error ?? "unknown error"}
                </p>
              )}
              {!current && last?.status === "posted" && <p className="text-xs text-green-700">Posted on schedule ({fmt(last.run_at)}).</p>}
            </div>
          );
        })}

      {msg && <p className={`text-xs ${msg.bad ? "text-red-700" : "text-green-700"}`}>{msg.text}</p>}
    </section>
  );
}
