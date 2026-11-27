import { planSegments } from "./timeline.ts";

// Decides what is on screen for each stretch of a comparison voiceover: the footage
// of the product the scene talks about, cycling through that product's videos (and
// continuing where the last cut stopped) so a 3-5 minute video doesn't repeat the
// same opening seconds. Pure, so it can be unit tested without ffmpeg.

export type FootageSource = { kind: "video" | "image"; file: string; /** Length in seconds (videos). */ length?: number };
export type CompareSegment = {
  start: number;
  end: number;
  /** 1-based product on screen, or null for an "all products" scene. */
  product: number | null;
  /** Which product's footage is actually shown (differs from `product` only for null scenes). */
  shown: number;
  source: FootageSource;
  /** Seconds into a video to start from. */
  offset: number;
};

/** Longest single cut before switching to the next clip of the same product. */
export const MAX_CUT = 9;

export function planCompare(
  scenes: { seconds: number; voiceover: string; product: number | null }[],
  words: { start: number; end: number }[],
  total: number,
  footage: FootageSource[][],
): CompareSegment[] {
  const available = footage.map((f, i) => (f.length ? i + 1 : 0)).filter(Boolean);
  if (available.length === 0) return [];
  // planSegments works on "photo" numbers: reuse it with the product number.
  const parts = planSegments(
    scenes.map((s) => ({ seconds: s.seconds, voiceover: s.voiceover, photo: s.product ?? undefined })),
    words,
    total,
  );
  const nextClip = new Map<number, number>(); // product -> index of the next clip to use
  const cursor = new Map<string, number>(); // file -> where the last cut stopped
  let rotate = 0;
  const out: CompareSegment[] = [];

  for (const p of parts) {
    const product = p.photoNumber;
    const pieces = Math.max(1, Math.ceil((p.end - p.start) / MAX_CUT - 1e-9));
    const len = (p.end - p.start) / pieces;
    for (let k = 0; k < pieces; k++) {
      // A product with no footage, or an "all products" scene, takes the next product in turn.
      let shown = product !== null && footage[product - 1]?.length ? product : available[rotate++ % available.length];
      if (product === null && out.length && out[out.length - 1].shown === shown && available.length > 1) {
        shown = available[rotate++ % available.length];
      }
      const list = footage[shown - 1];
      const ci = (nextClip.get(shown) ?? 0) % list.length;
      nextClip.set(shown, ci + 1);
      const source = list[ci];
      let offset = 0;
      if (source.kind === "video" && source.length && source.length > 0.5) {
        offset = cursor.get(source.file) ?? 0;
        if (offset >= source.length - 0.5) offset = 0;
        cursor.set(source.file, offset + len);
      }
      out.push({ start: p.start + k * len, end: p.start + (k + 1) * len, product, shown, source, offset: Number(offset.toFixed(3)) });
    }
  }
  return out;
}
