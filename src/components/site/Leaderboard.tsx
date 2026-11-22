import type { RankedRow } from "@/lib/leaderboard";

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

/** Top-ten list. `me` highlights the signed-in member's row. */
export default function Leaderboard({ rows, me }: { rows: RankedRow[]; me?: string | null }) {
  if (rows.length === 0) {
    return <p className="text-[15px] text-[#3D4C42]">No points yet. The first accepted scan takes the top spot.</p>;
  }
  return (
    <ol className="divide-y divide-[#E6EAE4]">
      {rows.map((r) => {
        const mine = !!me && r.handle === me;
        return (
          <li key={r.handle} className={`flex items-center gap-3 py-3 ${mine ? "font-bold text-[#1E6B45]" : ""}`}>
            <span className="w-8 shrink-0 text-center text-base font-bold tabular-nums text-[#5B6B60]" aria-label={`Rank ${r.rank}`}>
              {MEDAL[r.rank] ?? r.rank}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">
              @{r.handle}
              {mine ? " (you)" : ""}
            </span>
            <span className="shrink-0 tabular-nums">{r.points.toLocaleString("en-US")} pts</span>
          </li>
        );
      })}
    </ol>
  );
}
