import { supabase } from "./supabase";
import type { RevealChoice } from "./reveal";

// Hands a render to the render worker (worker/server.ts, on Cloud Run) so ffmpeg's CPU isn't
// billed as Vercel Active CPU. Vercel only waits on the network here, which uses no Active CPU.
// Unset RENDER_WORKER_URL to render inside the Vercel function again.

/** The worker's base URL, or null to render on Vercel. */
export function renderWorkerUrl(): string | null {
  const url = process.env.RENDER_WORKER_URL?.trim().replace(/\/+$/, "");
  return url ? url : null;
}

/** Waits for the worker to finish the render. Never throws; a failed hand-off fails the job. */
export async function renderOnWorker(url: string, scanId: string, jobId: string, reveal: RevealChoice): Promise<void> {
  let problem: string | null = null;
  try {
    const res = await fetch(`${url}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RENDER_WORKER_SECRET ?? ""}` },
      body: JSON.stringify({ scanId, jobId, reveal }),
      // Just under the route's maxDuration (300 s).
      signal: AbortSignal.timeout(290_000),
    });
    if (!res.ok) problem = `The render worker answered ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`;
  } catch (err) {
    // Out of time to wait: the worker may still finish. Its heartbeats decide (a silent job is written off).
    if (err instanceof Error && err.name === "TimeoutError") return;
    problem = `Could not reach the render worker: ${err instanceof Error ? err.message : String(err)}`;
  }
  if (!problem) return;
  console.error(problem);
  await supabase()
    .from("jobs")
    .update({ status: "failed", error: problem })
    .eq("id", jobId)
    .eq("status", "running");
}
