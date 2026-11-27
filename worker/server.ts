// Render worker: runs the same video render as the app (src/lib/render-job.ts), but on a container
// host with cheap CPU (Cloud Run) instead of inside a Vercel function.
//
// POST /render  { scanId, jobId, reveal }  with  Authorization: Bearer $RENDER_WORKER_SECRET
//   Renders the video and answers once it is done. Progress, cancel and the result all go through the
//   `jobs` row exactly as before, so the browser keeps polling /api/jobs/[id] on Vercel.
// POST /render-comparison  { comparisonId, jobId }  (same auth): renders a comparison video.
// GET /healthz  ->  200
//
// Needs the same env as the app for rendering: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_IMAGES_BUCKET, R2_VIDEOS_BUCKET
// (optional: RENDER_PRESET, FONTS_DIR, FFMPEG_PATH).

import { createServer, type IncomingMessage } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { runRender } from "../src/lib/render-job";
import { runCompareRender } from "../src/lib/compare-render";
import { parseReveal } from "../src/lib/reveal";

const SECRET = process.env.RENDER_WORKER_SECRET;
if (!SECRET || SECRET.length < 24) {
  console.error("Set RENDER_WORKER_SECRET (24+ characters) before starting the render worker.");
  process.exit(1);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Constant-time compare of the bearer token (hashing first makes the lengths equal). */
function authorized(req: IncomingMessage): boolean {
  const header = req.headers.authorization ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const a = createHash("sha256").update(header.slice(7)).digest();
  const b = createHash("sha256").update(SECRET!).digest();
  return timingSafeEqual(a, b);
}

async function readBody(req: IncomingMessage, limit = 4096): Promise<string> {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > limit) throw new Error("Body too large.");
  }
  return body;
}

const server = createServer(async (req, res) => {
  const send = (status: number, data: unknown) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };

  if (req.method === "GET" && req.url === "/healthz") return send(200, { ok: true });
  if (req.method !== "POST" || (req.url !== "/render" && req.url !== "/render-comparison")) return send(404, { error: "Not found." });
  if (!authorized(req)) return send(401, { error: "Unauthorized." });

  if (req.url === "/render-comparison") {
    let body: { comparisonId?: unknown; jobId?: unknown };
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return send(400, { error: "Send JSON." });
    }
    if (typeof body.comparisonId !== "string" || !UUID.test(body.comparisonId) || typeof body.jobId !== "string" || !UUID.test(body.jobId)) {
      return send(400, { error: "comparisonId and jobId must be UUIDs." });
    }
    const t0 = Date.now();
    await runCompareRender(body.comparisonId, body.jobId); // never throws
    console.log(`comparison render ${body.jobId} finished in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    return send(200, { ok: true });
  }

  let input: { scanId?: unknown; jobId?: unknown; reveal?: unknown };
  try {
    input = JSON.parse(await readBody(req));
  } catch {
    return send(400, { error: "Send JSON." });
  }
  const { scanId, jobId } = input;
  if (typeof scanId !== "string" || !UUID.test(scanId) || typeof jobId !== "string" || !UUID.test(jobId)) {
    return send(400, { error: "scanId and jobId must be UUIDs." });
  }

  const started = Date.now();
  // runRender never throws: success, failure and cancel are all written to the jobs row.
  await runRender(scanId, jobId, parseReveal(input.reveal));
  console.log(`render ${jobId} finished in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  send(200, { ok: true });
});

const port = Number(process.env.PORT) || 8080;
server.listen(port, () => console.log(`render worker listening on :${port}`));
