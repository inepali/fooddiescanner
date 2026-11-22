import { test } from "node:test";
import assert from "node:assert/strict";
import { dropRiskySentences, riskyTerms, safeReason } from "./wording.ts";
import { buildPrompt, fixCounts, scrubScript, wrongCount, type VideoScript } from "./script.ts";
import { scrubCopy } from "./copy.ts";

test("riskyTerms: catches safety, disease, deception and buying-advice words", () => {
  const said = (t: string) => riskyTerms(t).map((h) => h.phrase);
  assert.deepEqual(said("Boric acid can be harmful in excess."), ["harmful"]);
  for (const w of ["petroleum-derived", "linked to", "hyperactivity"]) assert.ok(said("A petroleum-derived dye, linked to hyperactivity.").includes(w));
  assert.ok(said("But wait until you hear what's hiding in the next one.").includes("wait until you hear"));
  assert.ok(said("These chips are sneakier than they look.").includes("sneakier"));
  assert.ok(said("Think twice before this goes in your cart.").includes("think twice"));
  assert.ok(said("Now the five I'd worry about.").includes("i'd worry"));
  assert.ok(said("Restricted in some regions.").includes("restricted"));
});

test("riskyTerms: leaves informative, neutral wording alone", () => {
  for (const ok of [
    "Sugar is number two. Ingredients are listed by amount, so that's a lot.",
    "Yellow 6 is a synthetic color additive, used for appearance.",
    "Dietary guidelines suggest limiting added sugars.",
    "Modified corn starch is a thickener. Our rubric scores it lower because it's highly processed.",
    "Now the two that scored lowest. Stay to the end.",
    "Natural flavor is a flavoring blend; the label doesn't list its components.",
    "It's minimally processed, because it's just one ingredient.",
  ]) assert.deepEqual(riskyTerms(ok), [], ok);
});

test("safeReason and dropRiskySentences", () => {
  assert.equal(safeReason("Synthetic petroleum-derived color additive."), null);
  assert.equal(safeReason("A refined starch with little fiber."), "A refined starch with little fiber.");
  assert.equal(dropRiskySentences("Salt adds sodium. It is toxic in excess. Check the label."), "Salt adds sodium. Check the label.");
});

test("buildPrompt: risky ingredient notes never reach the model; wording rules are included", () => {
  const p = buildPrompt({
    productName: "Vitamins",
    overall: 30,
    allergens: [],
    ingredients: [
      { name: "Boric acid", score: 10, reason: "Potentially toxic in excess." },
      { name: "Vitamin C", score: 80, reason: "An essential vitamin." },
    ],
  });
  assert.doesNotMatch(p, /Potentially toxic/);
  assert.match(p, /Vitamin C \[good\][^\n]*An essential vitamin/);
  assert.match(p, /WORDING RULES/);
  assert.match(p, /Vitamins, supplements and products for children/);
});

test("scrubScript: strips risky model lines, keeps your own lines", () => {
  const s: VideoScript = {
    title: "The worst thing in your cereal",
    scenes: [
      { seconds: 5, visual: "v", voiceover: "Sugar is second. It may spike your blood sugar. Dietary guidelines suggest limiting it." },
      { seconds: 5, visual: "v", voiceover: "This is harmful." },
      { seconds: 5, visual: "v", voiceover: "My own line: avoid it.", custom: true },
    ],
  };
  const out = scrubScript(s);
  assert.equal(out.title, "Ingredient check");
  assert.deepEqual(out.scenes.map((x) => x.voiceover), ["Sugar is second. Dietary guidelines suggest limiting it.", "My own line: avoid it."]);
});

test("counts: new spoken words are checked and corrected like the old ones", () => {
  const sc = (t: string): VideoScript => ({ title: "T", scenes: [{ seconds: 5, visual: "v", voiceover: t }] });
  assert.match(wrongCount(sc("Now the five that scored lowest."), 3, 2) ?? "", /says 5 worst/);
  assert.match(wrongCount(sc("The five highest-scoring first."), 3, 2) ?? "", /says 5 best/);
  assert.equal(wrongCount(sc("The three highest-scoring first. Now the two that scored lowest."), 3, 2), null);
  const fixed = fixCounts(sc("The five highest-scoring first. Now the five lowest-scoring ingredients."), 3, 2);
  assert.equal(fixed.scenes[0].voiceover, "The three highest-scoring first. Now the two lowest-scoring ingredients.");
});

test("scrubCopy: plain title and clean description", () => {
  const c = { title: "What's really in Oreos? The worst offenders", description: "Oreo ingredients, explained. The worst offenders might surprise you.\n\nNot medical advice.", hashtags: [] };
  const out = scrubCopy({ tiktok: c, instagram: c, youtube: c }, "Oreo");
  assert.equal(out.tiktok.title, "Oreo: ingredients explained");
  assert.equal(out.tiktok.description, "Oreo ingredients, explained.\n\nNot medical advice.");
});
