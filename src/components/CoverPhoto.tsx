"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { downscale, readJson } from "@/lib/image";

/**
 * The photo on this scan's card (home page, search, recent scans). Add one to older scans that
 * don't have a photo, or replace it with a better one.
 */
export default function CoverPhoto({ scanId, url, isLabel }: { scanId: string; url: string | null; isLabel: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", new File([await downscale(file)], "photo.jpg", { type: "image/jpeg" }));
      await readJson(await fetch(`/api/scans/${scanId}/cover`, { method: "POST", body }));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex items-center gap-4 rounded-2xl bg-white p-4">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Card photo" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
      ) : (
        <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-red-50 text-center text-xs font-medium text-red-700">
          No photo
        </span>
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium">Card photo</p>
        <p className="text-sm text-neutral-600">
          {!url
            ? "This scan has no photo, so its card shows none. Add a product photo."
            : isLabel
              ? "Using the label photo. Add a product photo for a better card."
              : "Shown on the home page, search and recent scans."}
        </p>
        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>
      <label className="shrink-0 cursor-pointer rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white">
        {busy ? "Uploading…" : url && !isLabel ? "Replace" : "Add photo"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            void upload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
    </section>
  );
}
