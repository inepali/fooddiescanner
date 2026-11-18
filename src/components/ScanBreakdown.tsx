import type { OffSummary } from "@/lib/openfoodfacts";
import type { Band } from "@/lib/scoring";

// The ingredient breakdown, shared by the admin scan page and the member result screen.
// Plain markup (no hooks), so it renders from server and client components alike.

// Full class names so Tailwind can see them.
export const BAND_BAR: Record<Band, string> = {
  great: "bg-green-600",
  good: "bg-lime-500",
  fair: "bg-yellow-400",
  poor: "bg-orange-500",
  avoid: "bg-red-600",
};
export const BAND_LABEL: Record<Band, string> = {
  great: "Great",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
  avoid: "Avoid",
};

export type BreakdownIngredient = {
  id: string;
  position: number;
  raw_name: string;
  score: number;
  band: Band;
  reason: string | null;
  provisional: boolean;
};

function Badge({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-xl bg-neutral-100 px-2 py-1">
      <span className="text-neutral-500">{label} </span>
      <strong>{value}</strong>
    </span>
  );
}

/** Nutri-Score / NOVA / additives from Open Food Facts, and how they moved the overall score. */
export function OffCrossCheck({
  off,
  labelScore,
  externalScore,
  overall,
}: {
  off: OffSummary;
  labelScore: number | null;
  externalScore: number | null;
  overall: number;
}) {
  return (
    <section className="space-y-2 rounded-2xl bg-white p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-medium">Cross-checked with Open Food Facts</h2>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
          {off.matchedBy === "barcode" ? "barcode match" : `${Math.round(off.confidence * 100)}% name + ingredient match`}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {off.nutriscore && <Badge label="Nutri-Score" value={off.nutriscore.toUpperCase()} />}
        {off.nova && <Badge label="NOVA" value={`${off.nova} of 4`} />}
        {off.green && <Badge label="Green-Score" value={off.green === "a-plus" ? "A+" : off.green.toUpperCase()} />}
        {off.palmOil !== null && <Badge label="Palm oil" value={off.palmOil ? "yes" : "none"} />}
        {off.additives.length > 0 && <Badge label="Additives" value={String(off.additives.length)} />}
      </div>
      <p className="text-neutral-600">
        Ingredient score {labelScore ?? "—"}
        {externalScore !== null && ` · Open Food Facts score ${externalScore}`} → overall {overall}.
      </p>
      {(off.nutrients.sugars_100g !== undefined || off.nutrients.salt_100g !== undefined) && (
        <p className="text-neutral-500">
          Per 100 g:
          {off.nutrients.sugars_100g !== undefined && ` sugars ${off.nutrients.sugars_100g} g`}
          {off.nutrients.saturated_fat_100g !== undefined && ` · saturated fat ${off.nutrients.saturated_fat_100g} g`}
          {off.nutrients.salt_100g !== undefined && ` · salt ${off.nutrients.salt_100g} g`}
          {off.nutrients.fiber_100g !== undefined && ` · fiber ${off.nutrients.fiber_100g} g`}
        </p>
      )}
      <p className="text-xs text-neutral-400">
        Matched “{off.name ?? off.code}”{off.brands ? ` (${off.brands})` : ""}. Data from{" "}
        <a href={off.url} className="underline" target="_blank" rel="noreferrer">
          Open Food Facts
        </a>{" "}
        (ODbL).
      </p>
    </section>
  );
}

/** Every ingredient in label order: name, score, band and a bar coloured by band. */
export function IngredientList({ ingredients }: { ingredients: BreakdownIngredient[] }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-medium">Ingredients ({ingredients.length})</h2>
      <ol className="space-y-3">
        {ingredients.map((ing) => (
          <li key={ing.id} className="rounded-2xl bg-white p-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium">
                {ing.position}. {ing.raw_name}
              </span>
              <span className="shrink-0 text-sm tabular-nums text-neutral-600">
                {ing.score} · {BAND_LABEL[ing.band]}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100">
              <div className={`h-full ${BAND_BAR[ing.band]}`} style={{ width: `${ing.score}%` }} />
            </div>
            {ing.reason && <p className="mt-2 text-sm text-neutral-600">{ing.reason}</p>}
            {ing.provisional && <p className="mt-1 text-xs text-neutral-400">Estimated by AI (not in the reference table yet)</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}
