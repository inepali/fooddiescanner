import { test } from "node:test";
import assert from "node:assert/strict";
import { buildComparePrompt, compareNarration, compareWordCount, parseCompareScript, suggestedRanking, type CompareProduct } from "./compare-script.ts";

const prod = (name: string, overall: number, poor = 0): CompareProduct => ({
  name,
  overall,
  allergens: [],
  ingredients: [
    { name: "oats", score: 85, reason: "whole grain" },
    ...Array.from({ length: poor }, (_, i) => ({ name: `additive ${i}`, score: 20, reason: null })),
  ],
});

test("suggested ranking: score first, fewer poor ingredients break ties", () => {
  assert.deepEqual(suggestedRanking([prod("A", 50), prod("B", 70), prod("C", 70, 2), prod("D", 70)]), [2, 4, 3, 1]);
});

test("prompt names every product and a forced winner", () => {
  const p = buildComparePrompt([prod("Alpha Bar", 60), prod("Beta Bar", 40)], { forcedWinner: 2 });
  assert.match(p, /PRODUCT 1: Alpha Bar/);
  assert.match(p, /PRODUCT 2: Beta Bar/);
  assert.match(p, /THE WINNER IS FIXED: product 2 \(Beta Bar\)/);
  assert.doesNotMatch(buildComparePrompt([prod("A", 60), prod("B", 40)]), /WINNER IS FIXED/);
});

test("parse: clamps products, fills the ranking, defaults bad sections", () => {
  const s = parseCompareScript(
    JSON.stringify({
      title: "A vs B vs C",
      verdict: { winner: 3, ranking: [3, 9, 1], summary: "C is cleanest." },
      scenes: [
        { section: "hook", product: null, seconds: 6, voiceover: "Same aisle. Very different labels." },
        { section: "weird", product: 7, seconds: 0, voiceover: "Round one." },
        { section: "intro", product: 2, seconds: 8, voiceover: "" },
      ],
    }),
    3,
  );
  assert.equal(s.scenes.length, 2);
  assert.equal(s.scenes[1].section, "round");
  assert.equal(s.scenes[1].product, null);
  assert.equal(s.scenes[1].seconds, 8);
  assert.deepEqual(s.verdict.ranking, [3, 1, 2]);
  assert.equal(compareNarration(s), "Same aisle. Very different labels. Round one.");
  assert.equal(compareWordCount(s), 7);
});

test("parse: winner falls back to ranking, then 1", () => {
  const base = { scenes: [{ section: "hook", voiceover: "Hi." }] };
  assert.equal(parseCompareScript(JSON.stringify({ ...base, verdict: { ranking: [2, 1] } }), 2).verdict.winner, 2);
  assert.equal(parseCompareScript(JSON.stringify(base), 2).verdict.winner, 1);
  assert.throws(() => parseCompareScript("{}", 2));
});
