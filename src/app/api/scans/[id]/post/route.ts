import { HttpError, handler, json, paramId } from "@/lib/http";
import { requireGuard } from "@/lib/social-accounts";
import { publishScan } from "@/lib/publish";
import { isPlatform } from "@/lib/social-platforms";

export const runtime = "nodejs";
export const maxDuration = 120;

// "Post now": sends the final video and your saved copy to a connected account (see src/lib/publish.ts).
export const POST = handler(async (req, ctx) => {
  requireGuard();
  const id = await paramId(ctx);
  const body = (await req.json().catch(() => ({}))) as { platform?: string; privacy?: string; again?: boolean; cover_seconds?: number };
  if (!isPlatform(body.platform)) throw new HttpError("Unknown platform.");
  const row = await publishScan(id, body.platform, { privacy: body.privacy, again: body.again, coverSeconds: body.cover_seconds });
  return json(row);
});
