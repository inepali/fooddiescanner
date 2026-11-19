export const MAX_PRODUCT_IMAGES = 5;

export type MediaItem = { id: string; kind: "label" | "product_image"; url: string };

type CoverCandidate = { kind: string; storage_path: string; sort_order: number };

/**
 * The photo shown on a scan's card: the first product photo (lowest sort_order), else the label.
 * Returns the storage key, or null when the scan has no photo at all.
 */
export function pickCover(media: CoverCandidate[]): string | null {
  const first = (kind: string) =>
    media.filter((m) => m.kind === kind).sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path ?? null;
  return first("product_image") ?? first("label");
}

/** Groups photos by scan and picks each scan's cover. */
export function coversByScan(media: (CoverCandidate & { scan_id: string })[]): Map<string, string> {
  const byScan = new Map<string, CoverCandidate[]>();
  for (const m of media) byScan.set(m.scan_id, [...(byScan.get(m.scan_id) ?? []), m]);
  const out = new Map<string, string>();
  for (const [id, list] of byScan) {
    const key = pickCover(list);
    if (key) out.set(id, key);
  }
  return out;
}
