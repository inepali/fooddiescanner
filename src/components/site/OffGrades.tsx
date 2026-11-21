import type { OffSummary } from "@/lib/openfoodfacts";

// Open Food Facts grades as colour scales: the product's grade is lifted and enlarged, the rest stay
// faded, so you see at a glance where it sits from best to worst.

type Step = { key: string; label: string; color: string };

const NUTRI: Step[] = [
  { key: "a", label: "A", color: "#038141" },
  { key: "b", label: "B", color: "#85BB2F" },
  { key: "c", label: "C", color: "#FECB02" },
  { key: "d", label: "D", color: "#EE8100" },
  { key: "e", label: "E", color: "#E63E11" },
];

const NOVA: Step[] = [
  { key: "1", label: "1", color: "#038141" },
  { key: "2", label: "2", color: "#FECB02" },
  { key: "3", label: "3", color: "#EE8100" },
  { key: "4", label: "4", color: "#E63E11" },
];

const GREEN: Step[] = [
  { key: "a-plus", label: "A+", color: "#1A7A43" },
  { key: "a", label: "A", color: "#038141" },
  { key: "b", label: "B", color: "#85BB2F" },
  { key: "c", label: "C", color: "#FECB02" },
  { key: "d", label: "D", color: "#EE8100" },
  { key: "e", label: "E", color: "#E63E11" },
  { key: "f", label: "F", color: "#A8200D" },
];

const NUTRI_WORDS: Record<string, string> = {
  a: "Very good nutrition",
  b: "Good nutrition",
  c: "Average nutrition",
  d: "Poor nutrition",
  e: "Bad nutrition",
};
const NOVA_WORDS: Record<string, string> = {
  "1": "Unprocessed or minimally processed",
  "2": "Processed culinary ingredient",
  "3": "Processed food",
  "4": "Ultra-processed food",
};
const GREEN_WORDS: Record<string, string> = {
  "a-plus": "Very low environmental impact",
  a: "Very low environmental impact",
  b: "Low environmental impact",
  c: "Moderate environmental impact",
  d: "High environmental impact",
  e: "Very high environmental impact",
  f: "Very high environmental impact",
};

/** Dark text on the light yellows and greens, white on the rest. */
function ink(color: string): string {
  return color === "#FECB02" || color === "#85BB2F" ? "#1F2A22" : "#FFFFFF";
}

function Scale({ title, steps, value, words, prefix }: { title: string; steps: Step[]; value: string; words: string; prefix: string }) {
  const current = steps.find((s) => s.key === value);
  if (!current) return null;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#E2E6DE] bg-white p-4 shadow-sm" style={{ borderTop: `4px solid ${current.color}` }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#56635B]">{title}</p>
          <p className="mt-0.5 text-[15px] font-semibold leading-snug">{words}</p>
        </div>
        <span
          className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-xl px-2 font-display text-xl font-extrabold"
          style={{ background: current.color, color: ink(current.color) }}
          aria-hidden
        >
          {current.label}
        </span>
      </div>
      <div className="flex items-end gap-1" role="img" aria-label={`${prefix} ${current.label}`}>
        {steps.map((s) => {
          const on = s.key === value;
          return (
            <span
              key={s.key}
              className={`flex flex-1 items-center justify-center rounded-md font-bold transition ${on ? "h-9 text-[15px] shadow-md ring-2 ring-white" : "h-6 text-[11px] opacity-35"}`}
              style={{ background: s.color, color: ink(s.color) }}
            >
              {s.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Nutri-Score, NOVA group and Green-Score as colour scales, for whichever grades the product has. */
export default function OffGrades({ off }: { off: OffSummary }) {
  const nutri = off.nutriscore?.toLowerCase() ?? null;
  const nova = off.nova ? String(off.nova) : null;
  const green = off.green?.toLowerCase() ?? null;
  if (!nutri && !nova && !green) return null;
  return (
    <section className="space-y-3" aria-labelledby="off-grades">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="off-grades" className="text-lg font-semibold">
          Open Food Facts grades
        </h2>
        <p className="text-sm text-neutral-500">
          {[
            nutri && `Nutri-Score ${nutri.toUpperCase()}`,
            nova && `NOVA ${nova}`,
            green && `Green-Score ${green === "a-plus" ? "A+" : green.toUpperCase()}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {nutri && <Scale title="Nutri-Score" steps={NUTRI} value={nutri} words={NUTRI_WORDS[nutri] ?? ""} prefix="Nutri-Score" />}
        {nova && <Scale title="NOVA group" steps={NOVA} value={nova} words={NOVA_WORDS[nova] ?? ""} prefix="NOVA group" />}
        {green && <Scale title="Green-Score" steps={GREEN} value={green} words={GREEN_WORDS[green] ?? ""} prefix="Green-Score" />}
      </div>
    </section>
  );
}
