import type { Metadata } from "next";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { BAND_LABEL, BAND_STYLE } from "@/lib/library";
import { bandFor, overallScore, applyCaps, type Band } from "@/lib/scoring";
import { EXTERNAL_WEIGHT, GREEN_POINTS, MIN_CONFIDENCE, NOVA_POINTS, NUTRI_POINTS, blendScores, externalScore } from "@/lib/openfoodfacts";

export const metadata: Metadata = {
  title: "Scoring rubric",
  description: "The published standard behind every Fooddie Score: ingredient bands, label-order weighting, caps and the Open Food Facts cross-check.",
};
// The reference table can be tuned; the page picks that up within an hour.
export const revalidate = 3600;

/** Bump the version and add a changelog line whenever the rubric changes. */
const VERSION = "1.0";
const EFFECTIVE = "November 27, 2026";
const CHANGELOG = [{ version: "1.0", date: EFFECTIVE, text: "First published version of the rubric." }];

const eyebrow = "text-sm font-bold uppercase tracking-[0.08em] text-[#1E6B45]";
const h2 = "font-display text-3xl font-extrabold tracking-tight sm:text-4xl";
const wrap = "mx-auto max-w-4xl px-5 sm:px-8";
const p = "text-[17px] leading-relaxed text-[#3C4A42]";
const card = "rounded-[22px] border border-[#E2E6DE] bg-white p-6 sm:p-8";

const BANDS: { band: Band; range: string; means: string; examples: string }[] = [
  { band: "great", range: "80–100", means: "Whole or minimally processed foods.", examples: "Vegetables, legumes, whole grains, nuts, seeds, water" },
  { band: "good", range: "60–79", means: "Lightly processed, recognisable foods.", examples: "Olive oil, spices, vinegar, plain dairy, citric acid" },
  { band: "fair", range: "40–59", means: "Refined or neutral ingredients.", examples: "Refined flour, salt, natural flavors, refined seed oils, gums" },
  { band: "poor", range: "20–39", means: "Added sugars, heavily refined oils, many additives.", examples: "Sugar, dextrose, soybean oil, modified starch, artificial flavors" },
  { band: "avoid", range: "0–19", means: "The most heavily processed ingredients.", examples: "High fructose corn syrup, synthetic dyes, partially hydrogenated oils" },
];

// A fixed worked example, computed with the same code that scores real scans.
const EXAMPLE = [
  { name: "Rolled oats", score: 85 },
  { name: "Sugar", score: 25 },
  { name: "Canola oil", score: 45 },
  { name: "Salt", score: 50 },
  { name: "Natural flavors", score: 50 },
];

type Ref = { canonical_name: string; score: number; notes: string | null };

export default async function ScoringRubricPage() {
  let refs: Ref[] = [];
  try {
    const { data } = await supabase().from("ingredient_reference").select("canonical_name, score, notes").order("score", { ascending: false });
    refs = (data ?? []) as Ref[];
  } catch {
    refs = [];
  }

  const weights = EXAMPLE.map((_, i) => 1 / (i + 1));
  const wSum = weights.reduce((a, b) => a + b, 0);
  const labelScore = overallScore(EXAMPLE);
  const ext = externalScore({ nutriscore: "c", nova: 4, green: null })!;
  const final = applyCaps(blendScores(labelScore, ext), EXAMPLE);
  const pct = (x: number) => `${Math.round(x * 100)}%`;

  return (
    <main className="pb-24">
      <section className={`${wrap} space-y-5 pb-12 pt-10 sm:pt-16`}>
        <p className={eyebrow}>The Fooddie Score · Rubric v{VERSION}</p>
        <h1 className="font-display text-5xl font-extrabold leading-[1.02] tracking-[-0.03em] sm:text-6xl">Scoring rubric</h1>
        <p className="text-lg leading-relaxed text-[#3C4A42] sm:text-xl">
          Every product in the library is scored with the same published rules, so two scores can be compared fairly. This page is that standard:
          what each number means, how it’s calculated, and where its limits are.
        </p>
        <p className="text-sm text-[#5B6A61]">Effective {EFFECTIVE}. Changes are versioned and listed at the bottom of this page.</p>
      </section>

      <div className={`${wrap} space-y-14`}>
        {/* 1. Scale */}
        <section className="space-y-5">
          <h2 className={h2}>1. The 0–100 scale</h2>
          <p className={p}>
            Higher is better. The score describes the <strong>ingredient list</strong> only: how whole or processed the ingredients are. It is not a
            safety rating, an allergy check or a judgement of whether a food is right for you.
          </p>
          <ul className="grid gap-3">
            {BANDS.map((b) => (
              <li key={b.band} className="grid gap-1 rounded-[18px] p-5 sm:grid-cols-[120px_160px_1fr] sm:items-center sm:gap-5" style={{ background: BAND_STYLE[b.band].bg, color: BAND_STYLE[b.band].fg }}>
                <span className="font-display text-3xl font-extrabold">{b.range}</span>
                <span className="text-lg font-bold">{BAND_LABEL[b.band]}</span>
                <span className="text-[15px] leading-snug">
                  {b.means} <span className="opacity-80">e.g. {b.examples}.</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* 2. Ingredient scores */}
        <section className="space-y-4">
          <h2 className={h2}>2. Every ingredient gets a score</h2>
          <p className={p}>
            Each ingredient is read from the label (or the product’s barcode record) in the printed order and given a 0–100 score using the band
            guide above, with a one-line reason you can read on the product page.
          </p>
          <ul className="list-disc space-y-2 pl-6 text-[17px] leading-relaxed text-[#3C4A42]">
            <li>
              <strong>Reference list first.</strong> Common ingredients have a fixed score in our reference list (below), so the same ingredient
              always scores the same, whatever the product or brand. Spelling variants and synonyms map to the same entry.
            </li>
            <li>
              <strong>Everything else is rated against the bands</strong> with AI help, following the same written guide, and treated as
              provisional. When an ingredient comes up often, it is reviewed and added to the reference list with a fixed score.
            </li>
            <li>“Organic”, percentages and brackets don’t change an ingredient’s score: organic cane sugar is scored as sugar.</li>
          </ul>
        </section>

        {/* 3. Label score */}
        <section className="space-y-4">
          <h2 className={h2}>3. Label order decides the weight</h2>
          <p className={p}>
            Ingredients are listed by weight, most first. So the label score is a weighted average where the ingredient in position <em>n</em> counts{" "}
            <strong>1/n</strong>: the first ingredient counts fully, the second half as much, the third a third, and so on. A little of something at
            the end of a long list moves the score far less than the same thing at the top.
          </p>
        </section>

        {/* 4. Caps */}
        <section className="space-y-4">
          <h2 className={h2}>4. Caps</h2>
          <p className={p}>Some ingredients matter even in small amounts, so after averaging two caps apply:</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className={card}>
              <p className="font-display text-3xl font-extrabold">max 60</p>
              <p className={p}>If any ingredient scores under 20 (for example a synthetic dye or high fructose corn syrup).</p>
            </div>
            <div className={card}>
              <p className="font-display text-3xl font-extrabold">max 30</p>
              <p className={p}>If the label lists partially hydrogenated oil (artificial trans fat).</p>
            </div>
          </div>
          <p className="text-sm text-[#5B6A61]">Caps apply to the final score too, after the Open Food Facts blend below.</p>
        </section>

        {/* 5. OFF blend */}
        <section className="space-y-4">
          <h2 className={h2}>5. Cross-check with Open Food Facts</h2>
          <p className={p}>
            When we can confidently match the product on Open Food Facts (by barcode, or by name with a matching ingredient list at least{" "}
            {pct(MIN_CONFIDENCE)} confident), its public grades become an outside score worth <strong>{pct(EXTERNAL_WEIGHT)}</strong> of the final
            number. The label score keeps the other {pct(1 - EXTERNAL_WEIGHT)}.
          </p>
          <div className="overflow-x-auto rounded-[18px] border border-[#E2E6DE] bg-white">
            <table className="w-full text-left text-[15px]">
              <thead className="bg-[#F0F3EC] text-[#14201A]">
                <tr>
                  <th className="px-4 py-3">Grade</th>
                  <th className="px-4 py-3">Share of outside score</th>
                  <th className="px-4 py-3">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E6DE] text-[#3C4A42]">
                <tr>
                  <td className="px-4 py-3 font-semibold">Nutri-Score (nutrition)</td>
                  <td className="px-4 py-3">50%</td>
                  <td className="px-4 py-3">{Object.entries(NUTRI_POINTS).map(([k, v]) => `${k.toUpperCase()} ${v}`).join(" · ")}</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold">NOVA (processing)</td>
                  <td className="px-4 py-3">35%</td>
                  <td className="px-4 py-3">{Object.entries(NOVA_POINTS).map(([k, v]) => `${k} → ${v}`).join(" · ")}</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold">Green-Score (environment)</td>
                  <td className="px-4 py-3">15%</td>
                  <td className="px-4 py-3">
                    {Object.entries(GREEN_POINTS).filter(([k]) => k !== "a").map(([k, v]) => `${k === "a-plus" ? "A+/A" : k.toUpperCase()} ${v}`).join(" · ")}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm text-[#5B6A61]">
            A missing grade is left out and the others are re-weighted. With no confident match, the score is the label score alone. Product pages
            show both parts.
          </p>
        </section>

        {/* 6. Worked example */}
        <section className="space-y-4">
          <h2 className={h2}>6. Worked example</h2>
          <div className={`${card} space-y-4`}>
            <ol className="space-y-1.5 text-[15px] text-[#3C4A42]">
              {EXAMPLE.map((x, i) => (
                <li key={x.name} className="flex justify-between gap-4 border-b border-dashed border-[#E2E6DE] pb-1.5">
                  <span>
                    {i + 1}. {x.name} <span className="text-[#5B6A61]">· score {x.score}</span>
                  </span>
                  <span className="tabular-nums">weight {pct(weights[i] / wSum)}</span>
                </li>
              ))}
            </ol>
            <ul className="space-y-1.5 text-[16px] text-[#14201A]">
              <li>
                Label score (weighted average, no caps triggered): <strong>{labelScore}</strong>
              </li>
              <li>
                Open Food Facts: Nutri-Score C (50) and NOVA 4 (10), no Green-Score → outside score <strong>{ext}</strong>
              </li>
              <li>
                Final: {labelScore} × {pct(1 - EXTERNAL_WEIGHT)} + {ext} × {pct(EXTERNAL_WEIGHT)} ={" "}
                <strong>
                  {final} ({BAND_LABEL[bandFor(final)]})
                </strong>
              </li>
            </ul>
          </div>
        </section>

        {/* 7. Reference list */}
        {refs.length > 0 && (
          <section className="space-y-4">
            <h2 className={h2}>7. Reference ingredient scores</h2>
            <p className={p}>The fixed scores used for common ingredients ({refs.length} entries). Synonyms on the label map to these.</p>
            <div className="overflow-x-auto rounded-[18px] border border-[#E2E6DE] bg-white">
              <table className="w-full text-left text-[15px]">
                <thead className="bg-[#F0F3EC] text-[#14201A]">
                  <tr>
                    <th className="px-4 py-3">Ingredient</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Why</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E6DE] text-[#3C4A42]">
                  {refs.map((r) => {
                    const band = bandFor(r.score);
                    return (
                      <tr key={r.canonical_name}>
                        <td className="px-4 py-2.5 font-medium capitalize text-[#14201A]">{r.canonical_name}</td>
                        <td className="px-4 py-2.5">
                          <span className="inline-block min-w-12 rounded-full px-2.5 py-0.5 text-center text-sm font-bold tabular-nums" style={{ background: BAND_STYLE[band].bg, color: BAND_STYLE[band].fg }}>
                            {r.score}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">{r.notes ?? ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 8. Limits */}
        <section className="space-y-4">
          <h2 className={h2}>{refs.length > 0 ? "8" : "7"}. What the score doesn’t do</h2>
          <ul className="list-disc space-y-2 pl-6 text-[17px] leading-relaxed text-[#3C4A42]">
            <li>It doesn’t measure amounts (grams of sugar, sodium, calories) beyond label order and the Nutri-Score cross-check.</li>
            <li>It isn’t personal: allergies, medical conditions and diets aren’t factored in. Allergens are listed separately on each product.</li>
            <li>It isn’t a safety, legal or regulatory judgement. Every product here is legally sold; the score is our opinion of the ingredient list.</li>
            <li>Labels change. Each breakdown reflects the label as scanned on its date, so always check the package in front of you.</li>
          </ul>
          <p className={p}>
            Spot a wrong ingredient or a score that looks off? <Link href="/#contact" className="font-semibold text-[#1E6B45] underline">Tell us</Link>{" "}
            and we’ll recheck it against this rubric.
          </p>
        </section>

        {/* Changelog */}
        <section className="space-y-3 border-t border-[#E2E6DE] pt-8">
          <h2 className="font-display text-2xl font-extrabold">Rubric changes</h2>
          <ul className="space-y-1.5 text-[15px] text-[#3C4A42]">
            {CHANGELOG.map((c) => (
              <li key={c.version}>
                <strong>v{c.version}</strong> · {c.date} · {c.text}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
