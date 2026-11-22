// Public top-ten leaderboard. Points are for recognition only: they have no monetary value
// and are never paid out or redeemed (see Terms §9). Only usernames and totals are shown.
import type { SupabaseClient } from "@supabase/supabase-js";

export const LEADERBOARD_SIZE = 10;

export type LeaderRow = { handle: string; points: number };
export type RankedRow = LeaderRow & { rank: number };

/**
 * Sorts by points (high first, then username) and ranks with ties sharing a place:
 * 500, 300, 300, 100 → 1, 2, 2, 4. Members with no username or no points are left out.
 */
export function rankLeaders(rows: { handle: string | null; points: number | null }[], size = LEADERBOARD_SIZE): RankedRow[] {
  const clean = rows
    .filter((r): r is LeaderRow => !!r.handle && typeof r.points === "number" && r.points > 0)
    .sort((a, b) => b.points - a.points || a.handle.localeCompare(b.handle))
    .slice(0, size);
  let rank = 0;
  return clean.map((r, i) => {
    if (i === 0 || r.points !== clean[i - 1].points) rank = i + 1;
    return { handle: r.handle, points: r.points, rank };
  });
}

/** Top ten members by total points. Server-only: the leaderboard view is closed to anon (0015). */
export async function topLeaders(db: SupabaseClient, size = LEADERBOARD_SIZE): Promise<RankedRow[]> {
  const { data, error } = await db
    .from("leaderboard")
    .select("handle, points")
    .not("handle", "is", null)
    .gt("points", 0)
    .order("points", { ascending: false })
    .order("handle", { ascending: true })
    .limit(size);
  if (error) throw new Error(`Could not load the leaderboard: ${error.message}`);
  return rankLeaders((data ?? []) as { handle: string | null; points: number | null }[], size);
}
