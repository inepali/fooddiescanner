// Read-only queries for the public library (fooddiescanner.com). Only scans you marked public
// (is_public) and that finished analysis are ever returned here.
import type { SupabaseClient } from "@supabase/supabase-js";
import { coverImagePath, coverRowsByScan } from "./media.ts";
import { bandFor, normalizeName, type Band } from "./scoring.ts";

export type ScanCard = {
  id: string;
  name: string;
  score: number;
  band: Band;
  createdAt: string;
  /** Up to three of the lowest-scoring ingredients (score under 40), worst first. */
  flags: string[];
  ingredientCount: number;
  /** Stable /img/<media id> address of the card photo (product photo, else label), or null if none. */
  image: string | null;
};

const FLAG_BELOW = 40;
const CARD_COLS = "id, product_name, overall_score, created_at";

type ScanRow = { id: string; product_name: string | null; overall_score: number; created_at: string };
type IngRow = { scan_id: string; raw_name: string; score: number | null; reason?: string | null };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const published = (q: any) => q.eq("is_public", true).eq("status", "analyzed").not("overall_score", "is", null);

/** Turns scan rows into cards, with each scan's worst ingredients as flags. */
async function toCards(db: SupabaseClient, scans: ScanRow[]): Promise<ScanCard[]> {
  if (scans.length === 0) return [];
  const ids = scans.map((s) => s.id);
  const [{ data, error }, { data: media }] = await Promise.all([
    db.from("scan_ingredients").select("scan_id, raw_name, score").in("scan_id", ids),
    db.from("scan_media").select("id, scan_id, kind, storage_path, sort_order").in("scan_id", ids).in("kind", ["product_image", "label"]),
  ]);
  if (error) throw new Error(`Could not load ingredients: ${error.message}`);
  const covers = coverRowsByScan((media ?? []) as { id: string; scan_id: string; kind: string; storage_path: string; sort_order: number }[]);
  const byScan = new Map<string, IngRow[]>();
  for (const row of (data ?? []) as IngRow[]) {
    const list = byScan.get(row.scan_id) ?? [];
    list.push(row);
    byScan.set(row.scan_id, list);
  }
  return scans.map((s) => {
    const ings = byScan.get(s.id) ?? [];
    const flags = ings
      .filter((i) => i.score != null && i.score < FLAG_BELOW)
      .sort((a, b) => (a.score as number) - (b.score as number))
      .map((i) => tidy(i.raw_name))
      .filter((n, i, all) => all.indexOf(n) === i)
      .slice(0, 3);
    return {
      id: s.id,
      name: s.product_name?.trim() || "Scanned product",
      score: s.overall_score,
      band: bandFor(s.overall_score),
      createdAt: s.created_at,
      flags,
      ingredientCount: ings.length,
      image: covers.has(s.id) ? coverImagePath(covers.get(s.id)!.id) : null,
    };
  });
}

/** "SUGAR (CANE)" -> "Sugar (cane)": labels are often all caps. */
export function tidy(name: string): string {
  const t = name.trim().replace(/\s+/g, " ");
  if (t !== t.toUpperCase()) return t.charAt(0).toUpperCase() + t.slice(1);
  const lower = t.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** Newest public scans first. */
export async function recentScans(db: SupabaseClient, limit = 6): Promise<ScanCard[]> {
  const { data, error } = await published(db.from("scans").select(CARD_COLS))
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Could not load scans: ${error.message}`);
  return toCards(db, (data ?? []) as ScanRow[]);
}

/** Escapes LIKE wildcards so a search for "100%" means the text "100%". */
const likeSafe = (q: string) => q.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * Product name, ingredient or barcode search over public scans. Products whose name matches come
 * first, then ones that contain a matching ingredient; each group newest first.
 */
export async function searchScans(db: SupabaseClient, raw: string, limit = 60): Promise<ScanCard[]> {
  const q = raw.trim().slice(0, 100);
  if (!q) return [];
  const pattern = `%${likeSafe(q)}%`;

  const byName = published(db.from("scans").select(CARD_COLS)).ilike("product_name", pattern).limit(limit);
  const byCode = /^\d{6,14}$/.test(q) ? published(db.from("scans").select(CARD_COLS)).eq("off_code", q).limit(5) : null;
  const byIng = db.from("scan_ingredients").select("scan_id").ilike("raw_name", pattern).limit(1000);

  const [name, code, ing] = await Promise.all([byName, byCode ?? Promise.resolve({ data: [], error: null }), byIng]);
  for (const r of [name, code, ing]) if (r.error) throw new Error(`Search failed: ${r.error.message}`);

  const seen = new Set<string>();
  const out: ScanRow[] = [];
  const add = (rows: ScanRow[]) =>
    rows
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .forEach((r) => {
        if (!seen.has(r.id) && out.length < limit) {
          seen.add(r.id);
          out.push(r);
        }
      });
  add((code.data ?? []) as ScanRow[]);
  add((name.data ?? []) as ScanRow[]);

  const ingIds = [...new Set(((ing.data ?? []) as { scan_id: string }[]).map((r) => r.scan_id))].filter((id) => !seen.has(id));
  if (ingIds.length > 0 && out.length < limit) {
    const { data, error } = await published(db.from("scans").select(CARD_COLS)).in("id", ingIds.slice(0, 300));
    if (error) throw new Error(`Search failed: ${error.message}`);
    add((data ?? []) as ScanRow[]);
  }
  return toCards(db, out);
}

export type FlaggedIngredient = { name: string; products: number; score: number; band: Band; reason: string | null };

/** The low-scoring ingredients that show up in the most public scans. */
export async function mostFlagged(db: SupabaseClient, limit = 6): Promise<FlaggedIngredient[]> {
  const { data: scans, error } = await published(db.from("scans").select("id"));
  if (error) throw new Error(`Could not load scans: ${error.message}`);
  const ids = ((scans ?? []) as { id: string }[]).map((s) => s.id);
  if (ids.length === 0) return [];
  const { data, error: e2 } = await db
    .from("scan_ingredients")
    .select("scan_id, raw_name, score, reason")
    .in("scan_id", ids)
    .lt("score", FLAG_BELOW);
  if (e2) throw new Error(`Could not load ingredients: ${e2.message}`);

  const groups = new Map<string, { name: string; scans: Set<string>; scores: number[]; reason: string | null }>();
  for (const row of (data ?? []) as IngRow[]) {
    const key = normalizeName(row.raw_name);
    if (!key) continue;
    const g = groups.get(key) ?? { name: tidy(row.raw_name), scans: new Set(), scores: [], reason: null };
    g.scans.add(row.scan_id);
    if (row.score != null) g.scores.push(row.score);
    if (!g.reason && row.reason) g.reason = row.reason;
    // Prefer the shortest spelling as the display name ("Sugar" over "Sugar (cane)").
    if (tidy(row.raw_name).length < g.name.length) g.name = tidy(row.raw_name);
    groups.set(key, g);
  }
  return [...groups.values()]
    .sort((a, b) => b.scans.size - a.scans.size || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((g) => {
      const score = Math.round(g.scores.reduce((s, n) => s + n, 0) / Math.max(1, g.scores.length));
      return { name: g.name, products: g.scans.size, score, band: bandFor(score), reason: g.reason };
    });
}

/** Counts for the hero: public products, and distinct ingredients across them. */
export async function libraryStats(db: SupabaseClient): Promise<{ products: number; ingredients: number }> {
  const { data, error } = await published(db.from("scans").select("id"));
  if (error) throw new Error(`Could not load scans: ${error.message}`);
  const ids = ((data ?? []) as { id: string }[]).map((s) => s.id);
  if (ids.length === 0) return { products: 0, ingredients: 0 };
  const { data: ings, error: e2 } = await db.from("scan_ingredients").select("raw_name").in("scan_id", ids);
  if (e2) throw new Error(`Could not load ingredients: ${e2.message}`);
  const names = new Set(((ings ?? []) as { raw_name: string }[]).map((r) => normalizeName(r.raw_name)).filter(Boolean));
  return { products: ids.length, ingredients: names.size };
}

/** Ids and dates of every public scan, for the sitemap. */
export async function publicScanIds(db: SupabaseClient): Promise<{ id: string; createdAt: string }[]> {
  const { data, error } = await published(db.from("scans").select("id, created_at")).order("created_at", { ascending: false });
  if (error) return [];
  return ((data ?? []) as { id: string; created_at: string }[]).map((r) => ({ id: r.id, createdAt: r.created_at }));
}

export const BAND_LABEL: Record<Band, string> = { great: "Great", good: "Good", fair: "Fair", poor: "Low", avoid: "Very low" };

/** Badge colours: the app's band shades, with text that passes contrast on each. */
export const BAND_STYLE: Record<Band, { bg: string; fg: string }> = {
  great: { bg: "#16a34a", fg: "#14201A" },
  good: { bg: "#84cc16", fg: "#14201A" },
  fair: { bg: "#facc15", fg: "#14201A" },
  poor: { bg: "#f97316", fg: "#14201A" },
  avoid: { bg: "#dc2626", fg: "#FFFFFF" },
};

/**
 * Runs a library query, falling back (and logging) if the database is unreachable or not configured,
 * e.g. a preview build without Supabase env vars. The public pages then render their empty states.
 */
export async function orEmpty<T>(load: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await load();
  } catch (err) {
    console.error("[library]", err instanceof Error ? err.message : err);
    return fallback;
  }
}
