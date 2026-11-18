import { NextResponse } from "next/server";
import { analyzeScan } from "@/lib/analyze-scan";

export const runtime = "nodejs";
export const maxDuration = 60;

// Anything thrown before the inner try/catch (missing env vars) would otherwise
// come back as an empty 500 and break the browser's res.json().
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return await analyzeScan((await params).id);
  } catch (err) {
    console.error("POST /api/scans/[id]/analyze failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected server error." },
      { status: 500 },
    );
  }
}
