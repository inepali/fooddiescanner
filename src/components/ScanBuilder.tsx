"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import MediaUploader from "./MediaUploader";
import BarcodeEntry from "./BarcodeEntry";
import { readJson } from "@/lib/image";
import type { MediaItem } from "@/lib/media";

export default function ScanBuilder({ scanId }: { scanId: string }) {
  const router = useRouter();
  const [hasLabel, setHasLabel] = useState(false);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [hasBarcode, setHasBarcode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    setBusy(true);
    setError(null);
    try {
      await readJson(await fetch(`/api/scans/${scanId}/analyze`, { method: "POST" }));
      router.push(`/scans/${scanId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <MediaUploader
        scanId={scanId}
        onMedia={(m: MediaItem[]) => {
          setHasLabel(m.some((x) => x.kind === "label"));
          setHasPhoto(m.length > 0);
        }}
      />

      <BarcodeEntry scanId={scanId} onFound={() => setHasBarcode(true)} />

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {hasBarcode && !hasPhoto && (
        <p className="text-sm text-neutral-600">Add a product photo too. It’s the picture on the scan’s card.</p>
      )}

      <button
        onClick={analyze}
        disabled={!(hasLabel || hasBarcode) || !hasPhoto || busy}
        className="w-full rounded-xl bg-accent px-4 py-3 font-medium text-white disabled:opacity-40"
      >
        {busy ? "Analyzing… usually 10–20 seconds" : hasBarcode && !hasLabel ? "Analyze product" : "Analyze label"}
      </button>
    </div>
  );
}
