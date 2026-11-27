import type { SupabaseClient } from "@supabase/supabase-js";
import { offFactsLine } from "./script";
import type { CompareProduct } from "./compare-script";

export type ComparisonRow = {
  id: string;
  title: string | null;
  scan_ids: string[];
  script: string | null;
  forced_winner: number | null;
  voice_id: string | null;
  audio_path: string | null;
  duration_s: number | null;
  words: { text: string; start: number; end: number }[] | null;
  video_path: string | null;
  created_at: string;
  updated_at: string;
};

export const COMPARISON_COLUMNS = "id, title, scan_ids, script, forced_winner, voice_id, audio_path, duration_s, words, video_path, created_at, updated_at";

export async function getComparison(db: SupabaseClient, id: string): Promise<ComparisonRow | null> {
  const { data, error } = await db.from("comparisons").select(COMPARISON_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load the comparison: ${error.message}`);
  return (data as ComparisonRow | null) ?? null;
}

/** The facts the script is written from, in the comparison's product order. Throws if a scan is missing or not analyzed. */
export async function loadCompareProducts(db: SupabaseClient, scanIds: string[]): Promise<CompareProduct[]> {
  const [{ data: scans }, { data: ings }] = await Promise.all([
    db.from("scans").select("id, product_name, status, overall_score, allergens, off_data").in("id", scanIds),
    db.from("scan_ingredients").select("scan_id, raw_name, score, reason, position").in("scan_id", scanIds).order("position"),
  ]);
  const byId = new Map((scans ?? []).map((s) => [s.id as string, s]));
  return scanIds.map((id, i) => {
    const s = byId.get(id);
    if (!s || s.status !== "analyzed" || s.overall_score === null) throw new Error(`Product ${i + 1} is missing or not analyzed yet.`);
    return {
      name: (s.product_name as string | null) ?? `Product ${i + 1}`,
      overall: s.overall_score as number,
      allergens: (s.allergens as string[] | null) ?? [],
      offFacts: offFactsLine((s.off_data as Parameters<typeof offFactsLine>[0]) ?? null),
      ingredients: (ings ?? [])
        .filter((x) => x.scan_id === id && x.score !== null)
        .map((x) => ({ name: x.raw_name as string, score: x.score as number, reason: (x.reason as string | null) ?? null })),
    };
  });
}
