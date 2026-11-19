export const MAX_PRODUCT_IMAGES = 5;

export type MediaItem = { id: string; kind: "label" | "product_image"; url: string };

type CoverCandidate = { kind: string; storage_path: string; sort_order: number };

/** The row of the photo shown on a scan's card: the first product photo (lowest sort_order), else the label. */
export function pickCoverRow<T extends CoverCandidate>(media: T[]): T | null {
  const first = (kind: string) => media.filter((m) => m.kind === kind).sort((a, b) => a.sort_order - b.sort_order)[0] ?? null;
  return first("product_image") ?? first("label");
}

/** The storage key of a scan's card photo, or null when the scan has no photo at all. */
export function pickCover(media: CoverCandidate[]): string | null {
  return pickCoverRow(media)?.storage_path ?? null;
}

/** Groups photos by scan and picks each scan's card photo row. */
export function coverRowsByScan<T extends CoverCandidate & { scan_id: string }>(media: T[]): Map<string, T> {
  const byScan = new Map<string, T[]>();
  for (const m of media) byScan.set(m.scan_id, [...(byScan.get(m.scan_id) ?? []), m]);
  const out = new Map<string, T>();
  for (const [id, list] of byScan) {
    const row = pickCoverRow(list);
    if (row) out.set(id, row);
  }
  return out;
}

/** Groups photos by scan and picks each scan's card photo storage key. */
export function coversByScan(media: (CoverCandidate & { scan_id: string })[]): Map<string, string> {
  return new Map([...coverRowsByScan(media)].map(([id, row]) => [id, row.storage_path]));
}

/**
 * Stable, cacheable address of a public scan's card photo (/img/<media id>). A replaced photo is a
 * new media row, so a new address: cached copies never go stale.
 */
export function coverImagePath(mediaId: string): string {
  return `/img/${mediaId}`;
}
