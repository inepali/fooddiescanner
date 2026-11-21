"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Section, VideoScript } from "@/lib/script";
import { DEFAULT_TONE, TONES, type Tone } from "@/lib/tones";

const SECTION_CHIP: Record<string, { label: string; cls: string }> = {
  hook: { label: "Hook", cls: "bg-neutral-100 text-neutral-700" },
  good: { label: "The good", cls: "bg-green-100 text-green-800" },
  fair: { label: "So-so", cls: "bg-yellow-100 text-yellow-800" },
  poor: { label: "Watch out", cls: "bg-red-100 text-red-800" },
  outro: { label: "Question", cls: "bg-indigo-100 text-indigo-800" },
};

export default function ScriptSection({
  scanId,
  initial,
}: {
  scanId: string;
  initial: VideoScript | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tone, setTone] = useState<Tone>(DEFAULT_TONE);

  // Remember the tone you like (a convenience only; fine if storage is unavailable).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("script-tone");
      if (saved && saved in TONES) setTone(saved as Tone);
    } catch {
      // ignore
    }
  }, []);
  function pickTone(t: Tone) {
    setTone(t);
    try {
      window.localStorage.setItem("script-tone", t);
    } catch {
      // ignore
    }
  }

  // Editing: each row remembers which saved line it came from ("from"), so visuals and photos carry over.
  type Row = { key: string; from?: number; section?: Section; voiceover: string };
  const toRows = (sc: VideoScript): Row[] => sc.scenes.map((s, i) => ({ key: `s${i}`, from: i, section: s.section, voiceover: s.voiceover }));
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [title, setTitle] = useState("");
  const [instruction, setInstruction] = useState("");
  const [working, setWorking] = useState<string | null>(null); // "save", "all" or a row key
  const [notice, setNotice] = useState<string | null>(null);
  const words = rows.reduce((n, r) => n + (r.voiceover.trim() ? r.voiceover.trim().split(/\s+/).length : 0), 0);

  function startEdit() {
    if (!initial) return;
    setRows(toRows(initial));
    setTitle(initial.title);
    setNotice(null);
    setError(null);
    setEditing(true);
  }
  const payload = (list: Row[]) => ({
    title,
    scenes: list.filter((r) => r.voiceover.trim()).map((r) => ({ from: r.from, section: r.section, voiceover: r.voiceover })),
  });
  async function send<T>(url: string, method: string, body: unknown): Promise<T> {
    const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const raw = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      // non-JSON body
    }
    if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : `Request failed (${res.status})`);
    return data as T;
  }
  async function save() {
    setWorking("save");
    setError(null);
    try {
      const r = await send<{ unchanged?: boolean }>(`/api/scans/${scanId}/script`, "PUT", { script: payload(rows) });
      setEditing(false);
      setNotice(r.unchanged ? "No changes to save." : "Script saved. Make a new voice take in the Voice tab to hear it.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saving failed.");
    } finally {
      setWorking(null);
    }
  }
  /** AI polish for one row (by key) or the whole script. The result lands in the editor, unsaved. */
  async function refine(key?: string) {
    const kept = rows.filter((r) => r.voiceover.trim());
    const scene = key ? kept.findIndex((r) => r.key === key) : undefined;
    if (key && scene === -1) return;
    setWorking(key ?? "all");
    setError(null);
    try {
      const r = await send<{ script: VideoScript }>(`/api/scans/${scanId}/script/refine`, "POST", {
        script: payload(kept),
        ...(scene !== undefined ? { scene } : {}),
        instruction,
      });
      setRows(kept.map((row, i) => ({ ...row, voiceover: r.script.scenes[i]?.voiceover ?? row.voiceover })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "The AI couldn't refine that.");
    } finally {
      setWorking(null);
    }
  }
  const setRow = (key: string, voiceover: string) => setRows((list) => list.map((r) => (r.key === key ? { ...r, voiceover } : r)));
  const addAfter = (key: string) =>
    setRows((list) => {
      const at = list.findIndex((r) => r.key === key);
      const row: Row = { key: `n${Date.now().toString(36)}`, section: list[at]?.section, voiceover: "" };
      return [...list.slice(0, at + 1), row, ...list.slice(at + 1)];
    });
  const remove = (key: string) => setRows((list) => list.filter((r) => r.key !== key));

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/scans/${scanId}/script`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tone }),
      });
      const raw = await res.text();
      let json: { error?: string } = {};
      try {
        json = raw ? (JSON.parse(raw) as typeof json) : {};
      } catch {
        // non-JSON body; fall through to the status message
      }
      if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const small = "rounded-lg bg-neutral-100 px-2.5 py-1 text-xs disabled:opacity-40";
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-medium">Video script</h2>
        <div className="flex gap-2">
          {initial && !editing && (
            <button onClick={startEdit} disabled={busy} className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium disabled:opacity-50">
              Edit lines
            </button>
          )}
          {!editing && (
            <button
              onClick={create}
              disabled={busy}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "Writing…" : initial ? "Rewrite script" : "Create Script"}
            </button>
          )}
        </div>
      </div>
      {!editing && (
        <div className="space-y-1">
          <label htmlFor="tone" className="text-xs text-neutral-500">
            Tone
          </label>
          <select
            id="tone"
            value={tone}
            onChange={(e) => pickTone(e.target.value as Tone)}
            disabled={busy}
            className="w-full rounded-xl bg-neutral-100 px-2 py-2 text-sm"
          >
            {(Object.keys(TONES) as Tone[]).map((t) => (
              <option key={t} value={t}>
                {TONES[t].label}
              </option>
            ))}
          </select>
          <p className="text-xs text-neutral-500">{TONES[tone].prompt}</p>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-green-700">{notice}</p>}

      {initial?.next && !editing && (
        <div className="space-y-1 rounded-2xl bg-indigo-50 p-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-indigo-700">Scan this next</p>
          <p className="font-medium">{initial.next.product}</p>
          {initial.next.why && <p className="text-neutral-600">{initial.next.why}</p>}
          {initial.next.teaser && <p className="text-xs text-neutral-500">Teased at the end of this video: &ldquo;{initial.next.teaser}&rdquo;</p>}
        </div>
      )}

      {editing && (
        <div className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            aria-label="Title"
            className="w-full rounded-xl bg-white px-3 py-2 font-medium"
          />
          <p className={`text-xs ${words > 175 ? "text-amber-700" : "text-neutral-500"}`}>
            {words} words · about {Math.round(words / 2.5)}s spoken (aim for 125–175 words, about a minute)
          </p>
          <ol className="space-y-3">
            {rows.map((r, i) => (
              <li key={r.key} className="space-y-2 rounded-2xl bg-white p-3 text-sm">
                <p className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                  {r.section && SECTION_CHIP[r.section] && (
                    <span className={`rounded-full px-2 py-0.5 font-medium ${SECTION_CHIP[r.section].cls}`}>{SECTION_CHIP[r.section].label}</span>
                  )}
                  <span>Line {i + 1}{r.from === undefined ? " · new" : ""}</span>
                </p>
                <textarea
                  value={r.voiceover}
                  onChange={(e) => setRow(r.key, e.target.value)}
                  rows={Math.max(2, Math.ceil(r.voiceover.length / 60))}
                  maxLength={400}
                  placeholder="What you'll say here"
                  disabled={working !== null}
                  className="w-full rounded-xl bg-neutral-100 px-2 py-1.5"
                />
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={small} disabled={working !== null || !r.voiceover.trim()} onClick={() => refine(r.key)}>
                    {working === r.key ? "Refining…" : "✨ Refine with AI"}
                  </button>
                  <button type="button" className={small} disabled={working !== null} onClick={() => addAfter(r.key)}>
                    + Add line after
                  </button>
                  <button type="button" className={`${small} text-red-700`} disabled={working !== null || rows.length <= 1} onClick={() => remove(r.key)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <div className="space-y-2 rounded-2xl bg-neutral-50 p-3">
            <label htmlFor="refine-note" className="text-xs text-neutral-500">
              Tell the AI what you want (optional, used by every Refine button)
            </label>
            <input
              id="refine-note"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              maxLength={300}
              placeholder='e.g. "punchier", "mention I bought it at Costco"'
              className="w-full rounded-xl bg-white px-2 py-1.5 text-sm"
            />
            <button type="button" className={small} disabled={working !== null} onClick={() => refine()}>
              {working === "all" ? "Polishing…" : "✨ Polish whole script"}
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={working !== null || words === 0}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {working === "save" ? "Saving…" : "Save script"}
            </button>
            <button onClick={() => setEditing(false)} disabled={working !== null} className="rounded-lg bg-neutral-100 px-4 py-2 text-sm">
              Cancel
            </button>
          </div>
          <p className="text-xs text-neutral-500">Saving keeps your exact words. Then make a new voice take; earlier takes stay for the old version.</p>
        </div>
      )}

      {initial && !editing && (
        <div className="space-y-3">
          <p className="font-medium">{initial.title}</p>
          <ol className="space-y-3">
            {initial.scenes.map((s, i) => (
              <li key={i} className="rounded-2xl bg-white p-3 text-sm">
                <p className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                  {s.section && SECTION_CHIP[s.section] && (
                    <span className={`rounded-full px-2 py-0.5 font-medium ${SECTION_CHIP[s.section].cls}`}>
                      {SECTION_CHIP[s.section].label}
                    </span>
                  )}
                  <span>
                    Scene {i + 1} · {s.seconds}s{s.photo ? ` · photo ${s.photo}` : ""}
                  </span>
                </p>
                <p className="mt-1">
                  <span className="font-medium">Visual:</span> {s.visual}
                </p>
                <p className="mt-1">
                  <span className="font-medium">Voiceover:</span> {s.voiceover}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
