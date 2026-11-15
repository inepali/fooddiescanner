import Link from "next/link";
import { BAND_LABEL, BAND_STYLE, type ScanCard as Card } from "@/lib/library";

/** One product in the library grid: score badge, score bar, worst ingredients. Links to its report. */
export default function ScanCard({ scan }: { scan: Card }) {
  const style = BAND_STYLE[scan.band];
  return (
    <Link
      href={`/p/${scan.id}`}
      className="group flex flex-col gap-4 rounded-[20px] border border-[#E2E6DE] bg-white p-5 text-[#14201A] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(20,32,26,0.10)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-[13px] font-semibold uppercase tracking-wider text-[#56635B]">
            {scan.ingredientCount} {scan.ingredientCount === 1 ? "ingredient" : "ingredients"}
          </p>
          <h3 className="font-display text-xl font-bold leading-snug [overflow-wrap:anywhere]">{scan.name}</h3>
        </div>
        <div
          className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl"
          style={{ background: style.bg, color: style.fg }}
          aria-label={`Score ${scan.score} out of 100, ${BAND_LABEL[scan.band]}`}
        >
          <span className="font-display text-[26px] font-extrabold leading-none">{scan.score}</span>
          <span className="text-[11px] font-bold">{BAND_LABEL[scan.band]}</span>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#E2E6DE]" aria-hidden>
        <div className="h-full rounded-full" style={{ width: `${scan.score}%`, background: style.bg }} />
      </div>
      {scan.flags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <span className="sr-only">Lowest-scoring ingredients:</span>
          {scan.flags.map((f) => (
            <span key={f} className="rounded-lg border border-[#F3C9A8] bg-[#FFF4EB] px-2.5 py-1.5 text-[13px] font-medium">
              {f}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[#3C4A42]">No low-scoring ingredients flagged.</p>
      )}
      <span className="mt-auto text-[15px] font-semibold text-[#1E6B45] group-hover:underline">Read breakdown →</span>
    </Link>
  );
}
