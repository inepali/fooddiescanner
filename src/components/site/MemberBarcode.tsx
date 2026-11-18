"use client";

import { useCallback, useState } from "react";
import { readJson } from "@/lib/image";
import { useBarcodeCamera } from "@/lib/use-barcode-camera";

type Props = {
  scanId: string;
  kind: "scan" | "video";
  /** The barcode already saved on this draft, if any. */
  saved: string | null;
  productName: string | null;
  disabled?: boolean;
  /** Called after the barcode is saved or removed, so the page reloads the draft. */
  onChange: () => Promise<void> | void;
};

/** Member barcode step: camera where the browser can read barcodes, otherwise type the digits. */
export default function MemberBarcode({ scanId, kind, saved, productName, disabled, onChange }: Props) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = useCallback(
    async (value: string) => {
      setBusy(true);
      setError(null);
      try {
        await readJson(
          await fetch(`/api/members/scans/${scanId}/barcode`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ barcode: value }),
          }),
        );
        setCode("");
        await onChange();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Lookup failed.");
      } finally {
        setBusy(false);
      }
    },
    [scanId, onChange],
  );
  const onCode = useCallback((value: string) => void lookup(value), [lookup]);
  const { videoRef, scanning, canScan, cameraError, start, stop } = useBarcodeCamera(onCode);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await readJson(await fetch(`/api/members/scans/${scanId}/barcode`, { method: "DELETE" }));
      await onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t remove it.");
    } finally {
      setBusy(false);
    }
  }

  const problem = error ?? cameraError;

  if (saved) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-[#EAF4EE] p-3">
        <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1E6B45] text-sm font-bold text-white">
          ✓
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{productName ?? "Product found"}</p>
          <p className="text-[13px] text-[#3D4C42]">
            Barcode {saved}
            {kind === "scan" ? " · no label photo needed" : ""}
          </p>
        </div>
        <button type="button" onClick={remove} disabled={busy || disabled} className="min-h-11 px-2 text-sm font-semibold text-[#5B6B60] disabled:opacity-50">
          Remove
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-[#D8DED6] p-3">
      <div>
        <p className="font-semibold">{kind === "scan" ? "Scan the barcode (fastest)" : "Scan the barcode (optional)"}</p>
        <p className="text-[13px] text-[#5B6B60]">
          {kind === "scan"
            ? "If we know the product, you can skip the label photo."
            : "Helps us find the exact product and its ingredients."}
        </p>
      </div>
      {scanning && (
        <div className="space-y-2">
          <video ref={videoRef} playsInline muted className="aspect-video w-full rounded-xl bg-black object-cover" />
          <button type="button" onClick={stop} className="min-h-11 text-sm font-semibold text-[#5B6B60]">
            Cancel
          </button>
        </div>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void lookup(code);
        }}
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^\d\s]/g, ""))}
          inputMode="numeric"
          placeholder="Digits under the bars"
          aria-label="Barcode number"
          className="h-11 min-w-0 flex-1 rounded-xl border border-[#D8DED6] px-3 text-base"
        />
        <button
          type="submit"
          disabled={busy || disabled || code.replace(/\D/g, "").length < 8}
          className="h-11 rounded-xl bg-[#F6F7F2] px-4 text-sm font-semibold text-[#1E6B45] disabled:opacity-50"
        >
          {busy ? "Looking…" : "Look up"}
        </button>
        {canScan && !scanning && (
          <button
            type="button"
            disabled={busy || disabled}
            onClick={() => void start()}
            className="h-11 rounded-xl bg-[#1E6B45] px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            Camera
          </button>
        )}
      </form>
      {!canScan && <p className="text-[12px] text-[#5B6B60]">On iPhone, type the numbers printed under the barcode.</p>}
      {problem && (
        <p role="alert" className="text-sm text-red-700">
          {problem}
        </p>
      )}
    </div>
  );
}
