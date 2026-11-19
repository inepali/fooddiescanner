"use client";

import { useCallback, useEffect, useState } from "react";
import { BAND_LABEL, IngredientList, OffCrossCheck, type BreakdownIngredient } from "@/components/ScanBreakdown";
import ScoreRing from "@/components/ScoreRing";
import MemberBarcode from "@/components/site/MemberBarcode";
import { downscale, readJson } from "@/lib/image";
import { PART_POINTS, POINTS, VIDEO_MIN_S, formatPoints, submissionPoints, videoLengthProblem, type Part, type SubmissionKind } from "@/lib/member-scan";
import type { OffSummary } from "@/lib/openfoodfacts";
import { bandFor } from "@/lib/scoring";

// Two separate member flows:
//   scan:  label photo → product photo → submit → ingredient breakdown
//   video: product photo → own 60 s video → product name → submit → waits for review

type State = {
  scan: {
    id: string;
    status: string;
    overall_score: number | null;
    product_name: string | null;
    submitted_at: string | null;
    review_status: string | null;
    off_code: string | null;
  };
  parts: { id: Part; label: string }[];
  photos: { kind: string; url: string }[];
  video: { duration_s: number | null } | null;
  missing: Part[];
  result: {
    ingredients: BreakdownIngredient[];
    allergens: string[];
    label_score: number | null;
    external_score: number | null;
    off: OffSummary | null;
  } | null;
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

export default function MemberScan({ kind = "scan" }: { kind?: SubmissionKind }) {
  const page = kind === "video" ? "/me/video" : "/me/scan";
  const [id, setId] = useState<string | null>(null);
  const [productName, setProductName] = useState("");
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (scanId: string) => {
    setState(await readJson<State & { error?: string }>(await fetch(`/api/members/scans/${scanId}`)));
  }, []);

  // A barcode fills in the product name; the member can still change it.
  const knownName = state?.scan.product_name ?? null;
  useEffect(() => {
    if (kind === "video" && knownName) setProductName((cur) => cur || knownName);
  }, [kind, knownName]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/members/scans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind }),
        });
        if (res.status === 401) return window.location.assign(`/signin?next=${page}`);
        const { id: scanId } = await readJson<{ id: string; error?: string }>(res);
        setId(scanId);
        await load(scanId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn’t start a scan.");
      }
    })();
  }, [load, kind, page]);

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
      await readJson(
        await fetch(`/api/members/scans/${id}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(kind === "video" ? { product_name: productName } : {}),
        }),
      );
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

  if (kind === "video" && state.scan.submitted_at) {
    const accepted = state.scan.review_status === "approved";
    return (
      <section className="space-y-5 rounded-3xl bg-white p-7 shadow-sm">
        <div>
          <p className="text-sm text-[#5B6B60]">{state.scan.product_name ?? "Your product"}</p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">{accepted ? "Video accepted! 🎉" : "Video sent!"}</h1>
          <p className="mt-1 text-[15px] text-[#3D4C42]">
            {accepted
              ? "Thanks! Your video was accepted."
              : "We’ll review it and let you know on your rewards page when it’s accepted."}
          </p>
        </div>
        <div className="grid gap-3">
          <a href="/me" className={`${btn} bg-[#1E6B45] text-white`}>
            Back to rewards
          </a>
        </div>
      </section>
    );
  }

  if (state.scan.status === "analyzed" && state.result && state.scan.overall_score !== null) {
    const overall = state.scan.overall_score;
    const { result } = state;
    return (
      <div className="space-y-5">
        <section className="space-y-4 rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex items-center gap-5">
            <ScoreRing score={overall} className="h-28 w-28" />
            <div className="min-w-0 space-y-1">
              <h1 className="font-display text-2xl font-extrabold tracking-tight">{state.scan.product_name ?? "Your product"}</h1>
              <p className="text-[#3D4C42]">
                Overall: <strong>{BAND_LABEL[bandFor(overall)]}</strong> ({overall}/100)
              </p>
              {result.allergens.length > 0 && <p className="text-sm text-[#5B6B60]">Contains: {result.allergens.join(", ")}</p>}
            </div>
          </div>
          <p className="text-[15px] text-[#1E6B45]">Submitted! Your points are on your rewards page, and we’ll let you know there when it’s accepted.</p>
        </section>
        {result.off && (
          <OffCrossCheck off={result.off} labelScore={result.label_score} externalScore={result.external_score} overall={overall} />
        )}
        <IngredientList ingredients={result.ingredients} />
        <p className="text-xs text-[#5B6B60]">Scores are a general nutrition rubric, not medical advice.</p>
        <div className="grid gap-3">
          <a href={page} className={`${btn} bg-[#1E6B45] text-white`}>
            Scan another product
          </a>
          <a href="/me" className={`${btn} bg-white text-[#14201A]`}>
            Back to rewards
          </a>
        </div>
      </div>
    );
  }

  const done = (p: Part) => !state.missing.includes(p);
  const thumb = (kind: string) => state.photos.find((x) => x.kind === kind)?.url;

  return (
    <section className="space-y-5 rounded-3xl bg-white p-7 shadow-sm">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">{kind === "video" ? "Send a video" : "Scan a product"}</h1>
        <p className="text-[15px] text-[#3D4C42]">
          {kind === "video"
            ? `A product photo and your one-minute video. Earn ${formatPoints(submissionPoints("video"))} points when we accept it.`
            : `Scan the barcode or snap the label, add a product photo, and earn ${submissionPoints("scan")} points (${POINTS.first_scan} more if you’re first to scan it). One scan every 24 hours.`}
        </p>
      </div>
      {id && (
        <MemberBarcode
          scanId={id}
          kind={kind}
          saved={state.scan.off_code}
          productName={state.scan.product_name}
          disabled={busy !== null}
          onChange={() => load(id)}
        />
      )}
      <ol className="space-y-3">
        {state.parts.map((p, i) => (
          <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-[#D8DED6] p-3">
            <span
              aria-hidden
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${done(p.id) ? "bg-[#1E6B45] text-white" : "bg-[#F6F7F2]"}`}
            >
              {done(p.id) ? "✓" : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{p.label}</p>
              <p className="mt-0.5 inline-block rounded-full bg-[#FFF4D6] px-2 py-0.5 text-[12px] font-bold text-[#7A5200]">
                +{formatPoints(PART_POINTS[p.id])} points{p.id === "product_video" ? " when accepted" : ""}
              </p>
              <p className="text-[13px] text-[#5B6B60]">
                {p.id === "label" &&
                  (state.scan.off_code && !thumb("label")
                    ? "Not needed: we have the barcode."
                    : "Flat, close and well lit, so we can read every word.")}
                {p.id === "product_image" && "A real photo of the front of the package."}
                {p.id === "product_video" &&
                  (state.video?.duration_s
                    ? `Uploaded (${Math.round(state.video.duration_s)} s)`
                    : `About a minute (at least ${VIDEO_MIN_S} s): show the product and talk about it.`)}
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
      {kind === "video" && (
        <label className="block space-y-1">
          <span className="font-semibold">Product name</span>
          <input
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            maxLength={80}
            placeholder="e.g. Honey Nut Cheerios"
            className="h-12 w-full rounded-xl border border-[#D8DED6] px-3 text-base"
          />
        </label>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={busy !== null || state.missing.length > 0 || (kind === "video" && productName.trim().length < 2)}
        className={`${btn} bg-[#1E6B45] text-white`}
      >
        {busy === "submit"
          ? kind === "video"
            ? "Sending…"
            : "Reading your label…"
          : kind === "video"
            ? "Send for review"
            : "Submit and see the score"}
      </button>
    </section>
  );
}
