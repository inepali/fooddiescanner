"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import LargeTitle from "./LargeTitle";
import { TONES, DEFAULT_TONE, type Tone } from "@/lib/tones";
import { DELIVERIES, DEFAULT_DELIVERY, type Delivery } from "@/lib/delivery";
import { usePoll } from "@/lib/use-poll";
import type { CompareScript } from "@/lib/compare-script";

export type CompareItem = { n: number; id: string; name: string; score: number | null; thumb: string | null; videos: number; photos: number };

type Props = {
  id: string;
  title: string;
  items: CompareItem[];
  script: CompareScript | null;
  forcedWinner: number | null;
  audioUrl: string | null;
  durationS: number | null;
  videoUrl: string | null;
  downloadUrl: string | null;
  renderJobId: string | null;
  renderStartedAt: string | null;
  renderProgress: { stage?: string; percent?: number } | null;
  renderError: string | null;
};

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const raw = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    // not JSON
  }
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : `Server error (HTTP ${res.status}).`);
  return data as T;
}
const send = <T,>(url: string, body: unknown, method = "POST") =>
  call<T>(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const SECTION_LABEL = { hook: "Hook", intro: "Intro", round: "Round", verdict: "Verdict", outro: "Outro" } as const;

export default function CompareWorkspace(p: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [tone, setTone] = useState<Tone>(DEFAULT_TONE);
  const [winner, setWinner] = useState<number>(p.forcedWinner ?? 0);
  const [lines, setLines] = useState<string[]>(p.script?.scenes.map((s) => s.voiceover) ?? []);
  const [voices, setVoices] = useState<{ id: string; name: string }[]>([]);
  const [voiceId, setVoiceId] = useState("");
  const [delivery, setDelivery] = useState<Delivery>(DEFAULT_DELIVERY);
  const [progress, setProgress] = useState(p.renderProgress);
  const [now, setNow] = useState(Date.now());

  useEffect(() => setLines(p.script?.scenes.map((s) => s.voiceover) ?? []), [p.script]);
  useEffect(() => setProgress(p.renderProgress), [p.renderProgress]);
  useEffect(() => {
    call<{ voices: { id: string; name: string }[]; selected: string }>("/api/voices")
      .then((r) => {
        setVoices(r.voices);
        setVoiceId(r.selected);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!p.renderJobId) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [p.renderJobId]);
  usePoll(
    async () => {
      if (!p.renderJobId) return;
      const r = await call<{ status: string; progress?: { stage?: string; percent?: number } | null }>(`/api/jobs/${p.renderJobId}`).catch(() => null);
      if (!r) return;
      if (r.status === "running") setProgress(r.progress ?? null);
      else router.refresh();
    },
    2000,
    { enabled: p.renderJobId !== null },
  );

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    setNote(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  const words = lines.reduce((n, l) => n + (l.trim() ? l.trim().split(/\s+/).length : 0), 0);
  const dirty = p.script ? lines.some((l, i) => l.trim() !== p.script!.scenes[i]?.voiceover) : false;
  const name = (n: number) => p.items[n - 1]?.name ?? `Product ${n}`;
  const noFootage = p.items.filter((i) => i.videos === 0 && i.photos === 0);
  const photosOnly = p.items.filter((i) => i.videos === 0 && i.photos > 0);
  const elapsed = p.renderStartedAt ? Math.max(0, Math.round((now - new Date(p.renderStartedAt).getTime()) / 1000)) : 0;
  const card = "space-y-3 rounded-2xl bg-white p-4";
  const btn = "rounded-xl bg-accent px-4 py-2.5 font-semibold text-white disabled:opacity-40";
  const btn2 = "rounded-xl border px-4 py-2.5 font-medium text-neutral-700 disabled:opacity-40";

  return (
    <div className="space-y-5">
      <LargeTitle title={p.title} subtitle={<Link href="/compare" className="text-accent">← Comparisons</Link>} />

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {p.items.map((it) => (
          <li key={it.id} className={`relative rounded-2xl bg-white p-2 ${p.script?.verdict.winner === it.n ? "ring-2 ring-green-500" : ""}`}>
            <Link href={`/scans/${it.id}`} className="block space-y-1.5">
              {it.thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.thumb} alt="" className="aspect-square w-full rounded-xl object-cover" />
              ) : (
                <div className="aspect-square w-full rounded-xl bg-neutral-100" />
              )}
              <p className="truncate text-sm font-medium">
                <span className="font-bold">{it.n}.</span> {it.name}
              </p>
              <p className="text-[12px] text-neutral-500">
                {it.score ?? "–"}/100 · {it.videos ? `${it.videos} video${it.videos > 1 ? "s" : ""}` : it.photos ? "photos only" : "no footage"}
              </p>
            </Link>
            {p.script?.verdict.winner === it.n && <span className="absolute right-3 top-3 rounded-full bg-green-600 px-2 py-0.5 text-[11px] font-bold text-white">WINNER</span>}
          </li>
        ))}
      </ul>
      {(noFootage.length > 0 || photosOnly.length > 0) && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {noFootage.length > 0 && <>No photo or video yet: {noFootage.map((i) => i.name).join(", ")}. Their scenes will show the other products. </>}
          {photosOnly.length > 0 && <>Photos only (slow zoom): {photosOnly.map((i) => i.name).join(", ")}. Upload a video on the scan&apos;s Video tab for real footage.</>}
        </p>
      )}

      {/* 1. Script + verdict */}
      <section className={card}>
        <h2 className="text-lg font-semibold">1. Script &amp; verdict</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-sm">
            <span className="text-neutral-500">Tone</span>
            <select value={tone} onChange={(e) => setTone(e.target.value as Tone)} className="mt-1 w-full rounded-lg border px-3 py-2">
              {Object.entries(TONES).map(([k, t]) => (
                <option key={k} value={k}>{t.label}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-neutral-500">Winner</span>
            <select value={winner} onChange={(e) => setWinner(Number(e.target.value))} className="mt-1 w-full rounded-lg border px-3 py-2">
              <option value={0}>Let the AI decide</option>
              {p.items.map((it) => (
                <option key={it.n} value={it.n}>{it.n}. {it.name}</option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          className={btn}
          disabled={busy !== null}
          onClick={() => run("script", async () => void (await send(`/api/comparisons/${p.id}/script`, { tone, winner: winner || null })))}
        >
          {busy === "script" ? "Writing (up to a minute)…" : p.script ? "Rewrite script" : "Generate script"}
        </button>

        {p.script && (
          <>
            <div className="rounded-xl bg-green-50 p-3 text-sm">
              <p className="font-semibold text-green-900">
                Verdict: {name(p.script.verdict.winner)} {p.forcedWinner ? "(your pick)" : "(AI's pick)"}
              </p>
              <p className="text-green-900">Ranking: {p.script.verdict.ranking.map((n, i) => `${i + 1}. ${name(n)}`).join(" · ")}</p>
              {p.script.verdict.summary && <p className="mt-1 text-green-800">{p.script.verdict.summary}</p>}
            </div>
            <p className={`text-sm ${words < 400 || words > 560 ? "text-amber-700" : "text-neutral-500"}`}>
              {words} words · about {mmss(words / 2.5)} spoken (target 3:00)
            </p>
            <ol className="space-y-2">
              {p.script.scenes.map((s, i) => (
                <li key={i} className="space-y-1">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-neutral-500">
                    {SECTION_LABEL[s.section]} · {s.product ? `${s.product}. ${name(s.product)}` : "All products"}
                    {s.edited ? " · edited" : ""}
                  </p>
                  <textarea
                    value={lines[i] ?? ""}
                    onChange={(e) => setLines((l) => l.map((x, k) => (k === i ? e.target.value : x)))}
                    rows={Math.max(2, Math.ceil((lines[i]?.length ?? 0) / 60))}
                    className="w-full rounded-lg border px-3 py-2 text-[15px]"
                  />
                </li>
              ))}
            </ol>
            {dirty && (
              <button
                type="button"
                className={btn2}
                disabled={busy !== null}
                onClick={() => run("save", async () => void (await send(`/api/comparisons/${p.id}`, { lines }, "PATCH")))}
              >
                {busy === "save" ? "Saving…" : "Save edits (clears voice and video)"}
              </button>
            )}
          </>
        )}
      </section>

      {/* 2. Voice */}
      <section className={`${card} ${!p.script ? "opacity-50" : ""}`}>
        <h2 className="text-lg font-semibold">2. Voiceover</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-sm">
            <span className="text-neutral-500">Voice</span>
            <select value={voiceId} onChange={(e) => setVoiceId(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2">
              {voices.length === 0 && <option value="">Default voice</option>}
              {voices.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-neutral-500">Delivery</span>
            <select value={delivery} onChange={(e) => setDelivery(e.target.value as Delivery)} className="mt-1 w-full rounded-lg border px-3 py-2">
              {Object.entries(DELIVERIES).map(([k, d]) => (
                <option key={k} value={k}>{d.label}</option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          className={btn}
          disabled={!p.script || dirty || busy !== null}
          onClick={() =>
            run("voice", async () => {
              const r = await send<{ warning: string | null }>(`/api/comparisons/${p.id}/voice`, { voice_id: voiceId || undefined, delivery });
              if (r.warning) setNote(r.warning);
            })
          }
        >
          {busy === "voice" ? "Recording 3 minutes of voice…" : p.audioUrl ? "Record again" : "Generate voiceover"}
        </button>
        {dirty && <p className="text-sm text-amber-700">Save your script edits first.</p>}
        {p.audioUrl && (
          <div className="space-y-1">
            <audio controls src={p.audioUrl} className="w-full" />
            {p.durationS !== null && <p className="text-sm text-neutral-500">{mmss(p.durationS)} long</p>}
          </div>
        )}
      </section>

      {/* 3. Video */}
      <section className={`${card} ${!p.audioUrl ? "opacity-50" : ""}`}>
        <h2 className="text-lg font-semibold">3. Video</h2>
        <p className="text-sm text-neutral-500">
          1080×1920, cut from each product&apos;s own videos (photos when there are none) to match who is being talked about, with captions, a product label on top and the disclaimer at the end.
        </p>
        {p.renderJobId ? (
          <div className="space-y-2">
            <p className="text-sm">
              {progress?.stage ?? "Starting"} · {mmss(elapsed)}
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
              <div className="h-full bg-accent transition-all" style={{ width: `${progress?.percent ?? 2}%` }} />
            </div>
            <button
              type="button"
              className={btn2}
              onClick={() => run("cancel", async () => void (await call(`/api/jobs/${p.renderJobId}`, { method: "DELETE" })))}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            className={btn}
            disabled={!p.audioUrl || busy !== null}
            onClick={() => run("render", async () => void (await send(`/api/comparisons/${p.id}/render`, {})))}
          >
            {busy === "render" ? "Starting…" : p.videoUrl ? "Generate again" : "Generate video"}
          </button>
        )}
        {p.renderError && !p.renderJobId && <p className="text-sm text-red-600">{p.renderError}</p>}
        {p.videoUrl && !p.renderJobId && (
          <div className="space-y-2">
            <video controls src={p.videoUrl} className="mx-auto max-h-[70vh] rounded-xl bg-black" />
            {p.downloadUrl && (
              <a href={p.downloadUrl} className={`${btn2} block text-center`}>
                Download MP4
              </a>
            )}
          </div>
        )}
      </section>

      {note && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{note}</p>}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button
        type="button"
        className="text-sm text-red-600"
        disabled={busy !== null}
        onClick={() => {
          if (!confirm("Delete this comparison and its voice and video?")) return;
          void run("delete", async () => {
            await call(`/api/comparisons/${p.id}`, { method: "DELETE" });
            router.push("/compare");
          });
        }}
      >
        Delete comparison
      </button>
    </div>
  );
}
