"use client";

import { useCallback, useEffect, useState } from "react";
import { downscale, readJson } from "@/lib/image";
import { PARTS, videoLengthProblem, type Part } from "@/lib/member-scan";

// Member scan: label photo → product photo → own 60 s video → submit → ingredient breakdown.

type Ingredient = { name: string; score: number | null; band: string | null; reason: string | null };
type State = {
  scan: { id: string; status: string; overall_score: number | null; product_name: string | null };
  photos: { kind: string; url: string }[];
  video: { duration_s: number | null } | null;
  missing: Part[];
  ingredients: Ingredient[];
};

const BAND: Record<string, string> = {
  great: "bg-emerald-600",
  good: "bg-emerald-500",
  fair: "bg-amber-400",
  poor: "bg-orange-500",
  avoid: "bg-red-600",
};

const btn = "flex h-12 w-full items-center justify-center rounded-xl text-base font-semibold disabled:opacity-50";

function readDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    const url = URL.createObjectURL(file);
    const done = (n: number) => {
      URL.revokeObjectURL(url);
      resolve(n);
    };
    v.onloadedmetadata = () => done(v.duration);
    v.onerror = () => done(NaN);
    v.src = url;
  });
}

export default function MemberScan() {
  const [id, setId] = useState<string | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (scanId: string) => {
    setState(await readJson<State & { error?: string }>(await fetch(`/api/members/scans/${scanId}`)));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/members/scans", { method: "POST" });
        if (res.status === 401) return window.location.assign("/signin?next=/me/scan");
        const { id: scanId } = await readJson<{ id: string; error?: string }>(res);
        setId(scanId);
        await load(scanId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn’t start a scan.");
      }
    })();
  }, [load]);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError(null);
    try {
      await fn();
      if (id) await load(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  const photo = (kind: "label" | "product_image") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !id) return;
    run(kind, async () => {
      const form = new FormData();
      form.set("kind", kind);
      form.set("file", new File([await downscale(file)], "photo.jpg", { type: "image/jpeg" }));
      await readJson(await fetch(`/api/members/scans/${id}/photo`, { method: "POST", body: form }));
    });
  };

  const video = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !id) return;
    run("product_video", async () => {
      const duration = await readDuration(file);
      const problem = videoLengthProblem(duration);
      if (problem) throw new Error(problem);
      const { key, uploadUrl, contentType } = await readJson<{ key: string; uploadUrl: string; contentType: string; error?: string }>(
        await fetch(`/api/members/scans/${id}/video`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size, duration }),
        }),
      );
      const put = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
      if (!put.ok) throw new Error("The video upload failed. Check your connection and try again.");
      await readJson(
        await fetch(`/api/members/scans/${id}/video`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, duration }),
        }),
      );
    });
  };

  const submit = () =>
    id &&
    run("submit", async () => {
      await readJson(await fetch(`/api/members/scans/${id}/submit`, { method: "POST" }));
    });

  if (!state) {
    return error ? (
      <p role="alert" className="rounded-2xl bg-white p-6 text-red-700">
        {error}
      </p>
    ) : (
      <p className="p-6 text-center text-[#5B6B60]">Getting ready…</p>
    );
  }

  if (state.scan.status === "analyzed") {
    return (
      <section className="space-y-5 rounded-3xl bg-white p-7 shadow-sm">
        <div>
          <p className="text-sm text-[#5B6B60]">{state.scan.product_name ?? "Your product"}</p>
          <h1 className="font-display text-4xl font-extrabold">{state.scan.overall_score}/100</h1>
          <p className="mt-1 text-[15px] text-[#1E6B45]">Submitted! Your points are on your rewards page.</p>
        </div>
        <ol className="space-y-3">
          {state.ingredients.map((ing, i) => (
            <li key={i} className="flex gap-3">
              <span aria-hidden className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${BAND[ing.band ?? ""] ?? "bg-neutral-300"}`} />
              <div>
                <p className="font-semibold">
                  {ing.name} <span className="font-normal text-[#5B6B60]">· {ing.score ?? "–"}</span>
                </p>
                {ing.reason && <p className="text-sm text-[#3D4C42]">{ing.reason}</p>}
              </div>
            </li>
          ))}
        </ol>
        <div className="grid gap-3">
          <a href="/me/scan" className={`${btn} bg-[#1E6B45] text-white`}>
            Scan another product
          </a>
          <a href="/me" className={`${btn} bg-[#F6F7F2] text-[#14201A]`}>
            Back to rewards
          </a>
        </div>
      </section>
    );
  }

  const done = (p: Part) => !state.missing.includes(p);
  const thumb = (kind: string) => state.photos.find((x) => x.kind === kind)?.url;

  return (
    <section className="space-y-5 rounded-3xl bg-white p-7 shadow-sm">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Scan a product</h1>
        <p className="text-[15px] text-[#3D4C42]">Three things, then we’ll break down every ingredient.</p>
      </div>
      <ol className="space-y-3">
        {PARTS.map((p, i) => (
          <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-[#D8DED6] p-3">
            <span
              aria-hidden
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${done(p.id) ? "bg-[#1E6B45] text-white" : "bg-[#F6F7F2]"}`}
            >
              {done(p.id) ? "✓" : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{p.label}</p>
              <p className="text-[13px] text-[#5B6B60]">
                {p.id === "label" && "Flat, close and well lit, so we can read every word."}
                {p.id === "product_image" && "The front of the package."}
                {p.id === "product_video" &&
                  (state.video?.duration_s ? `Uploaded (${Math.round(state.video.duration_s)} s)` : "About a minute: show the product and talk about it.")}
              </p>
            </div>
            {p.id !== "product_video" && thumb(p.id) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb(p.id)} alt="" className="h-12 w-12 rounded-lg object-cover" />
            )}
            <label className="flex min-h-11 cursor-pointer items-center rounded-xl bg-[#F6F7F2] px-4 text-sm font-semibold text-[#1E6B45]">
              {busy === p.id ? "Uploading…" : done(p.id) ? "Replace" : p.id === "product_video" ? "Add video" : "Take photo"}
              <input
                type="file"
                className="sr-only"
                disabled={busy !== null}
                accept={p.id === "product_video" ? "video/mp4,video/quicktime,video/webm" : "image/*"}
                capture={p.id === "product_video" ? undefined : "environment"}
                onChange={p.id === "product_video" ? video : photo(p.id)}
                aria-label={p.label}
              />
            </label>
          </li>
        ))}
      </ol>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={busy !== null || state.missing.length > 0}
        className={`${btn} bg-[#1E6B45] text-white`}
      >
        {busy === "submit" ? "Reading your label…" : "Submit and see the score"}
      </button>
    </section>
  );
}
