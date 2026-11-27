import { after } from "next/server";
import { supabase } from "@/lib/supabase";
import { ffmpegPath, isRenderStale } from "@/lib/render";
import type { JobRow } from "@/lib/db-types";
import { runCompareRender } from "@/lib/compare-render";
import { renderComparisonOnWorker, renderWorkerUrl } from "@/lib/render-remote";
import { getComparison } from "@/lib/comparisons";
import { HttpError, handler, json, paramId } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 300;

// Starts the comparison render. The browser polls /api/jobs/[id], same as a scan render.
export const POST = handler(async (_req, ctx) => {
  const id = await paramId(ctx);
  const db = supabase();
  const worker = renderWorkerUrl();
  if (!worker) await ffmpegPath();

  const cmp = await getComparison(db, id);
  if (!cmp?.script) throw new HttpError("Create the script first.");
  if (!cmp.audio_path) throw new HttpError("Generate the voiceover first.");

  const { data: running } = await db
    .from("jobs")
    .select("id, status, created_at, output")
    .eq("comparison_id", id)
    .eq("step", "render")
    .eq("status", "running");
  let active = false;
  for (const j of (running ?? []) as Pick<JobRow, "id" | "status" | "created_at" | "output">[]) {
    if (isRenderStale(j)) await db.from("jobs").update({ status: "failed", error: "Timed out." }).eq("id", j.id).eq("status", "running");
    else active = true;
  }
  if (active) throw new HttpError("This comparison is already rendering.", 409);

  const { data: job, error } = await db.from("jobs").insert({ comparison_id: id, step: "render", status: "running" }).select("id").single();
  if (error || !job) throw new Error(`Could not start the render: ${error?.message}`);
  const jobId = job.id as string;
  after(() => (worker ? renderComparisonOnWorker(worker, id, jobId) : runCompareRender(id, jobId)));
  return json({ job_id: jobId });
});
