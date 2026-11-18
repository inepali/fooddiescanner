"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Accept (and choose whether it joins the public library) or reject a member's submission. Accepting notifies the member. */
export default function ReviewActions({ id, status, isPublic }: { id: string; status: string; isPublic: boolean }) {
  const router = useRouter();
  const [makePublic, setMakePublic] = useState(status === "pending" ? true : isPublic);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(next: "approved" | "rejected") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/scans/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next, public: makePublic }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Couldn’t save.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {status !== "pending" && (
        <p className="text-sm font-medium">
          {status === "approved" ? `Accepted · member notified${isPublic ? " · public" : " · private"}` : "Rejected · points taken back"}
        </p>
      )}
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={makePublic} onChange={(e) => setMakePublic(e.target.checked)} className="h-5 w-5" />
        Add to the public library when accepted
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => decide("rejected")}
          className="h-12 rounded-xl border border-red-200 font-semibold text-red-700 disabled:opacity-50"
        >
          Reject
        </button>
        <button type="button" disabled={busy} onClick={() => decide("approved")} className="h-12 rounded-xl bg-accent font-semibold text-white disabled:opacity-50">
          {busy ? "Saving…" : status === "approved" ? "Save" : "Accept"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
