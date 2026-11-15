import { supabase } from "@/lib/supabase";
import type { JobRow } from "@/lib/db-types";
import { HttpError, handler, json, paramId } from "@/lib/http";
import { isRenderStale } from "@/lib/render";

export const runtime = "nodejs";
export const maxDuration = 60;

// Polled by the browser for a job's status (and, for a render, its progress).
export const GET = handler(async (_req, ctx) => {
  const id = await paramId(ctx);
  const db = supabase();

  const { data } = await db.from("jobs").select("*").eq("id", id).maybeSingle();
  const job = data as JobRow | null;
  if (!job) throw new HttpError("Job not found.", 404);

  // A render whose function was cut off never reports back; stop waiting for it.
  if (job.step === "render" && isRenderStale(job)) {
    const message = "The render stopped responding (the server was probably cut off). Try again.";
    await db.from("jobs").update({ status: "failed", error: message }).eq("id", id).eq("status", "running");
    return json({ status: "failed", error: message });
  }

  return json({ status: job.status, error: job.error, progress: job.step === "render" ? job.output : null });
});

// Cancels a render that is stuck or no longer wanted. The render notices on its next progress write.
export const DELETE = handler(async (_req, ctx) => {
  const id = await paramId(ctx);
  const { data } = await supabase()
    .from("jobs")
    .update({ status: "failed", error: "Cancelled." })
    .eq("id", id)
    .eq("step", "render")
    .eq("status", "running")
    .select("id");
  return json({ cancelled: (data ?? []).length > 0 });
});
