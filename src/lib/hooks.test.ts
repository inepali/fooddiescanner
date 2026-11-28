import { test } from "node:test";
import assert from "node:assert/strict";
import { HOOK_STYLES, hasBannedOpening, pickHookStyle } from "./hooks.ts";
import { buildPrompt, parseScript } from "./script.ts";

test("pick skips the last three styles used", () => {
  for (let i = 0; i < 50; i++) {
    const pick = pickHookStyle(["shock", "myth", "story", "verdict"], Math.random);
    assert.ok(!["shock", "myth", "story"].includes(pick.id));
  }
});

test("pick falls back to any style if all were used", () => {
  assert.ok(HOOK_STYLES.includes(pickHookStyle(HOOK_STYLES.map((h) => h.id), () => 0.99)));
});

test("banned openers are caught, fresh ones are not", () => {
  for (const line of ["Healthy? Let's see.", "Is this actually healthy?", "So, is this cereal healthy?", "Looks healthy, right?"]) {
    assert.ok(hasBannedOpening(line), line);
  }
  for (const line of ["Sugar is the second ingredient.", "I almost bought this.", "The front says natural."]) {
    assert.ok(!hasBannedOpening(line), line);
  }
});

test("prompt shows only the chosen style and no healthy example", () => {
  const style = HOOK_STYLES.find((h) => h.id === "story")!;
  const p = buildPrompt({
    productName: "Oat Bar",
    overall: 50,
    allergens: [],
    hookStyle: style,
    ingredients: [
      { name: "oats", score: 85, reason: "whole grain" },
      { name: "sugar", score: 20, reason: "added sugar" },
    ],
  });
  assert.ok(p.includes(style.rule));
  assert.ok(!p.includes("actually healthy? One"));
  assert.ok(!p.includes(HOOK_STYLES.find((h) => h.id === "myth")!.rule));
});

test("saved scripts keep their hook style", () => {
  const s = parseScript(JSON.stringify({ title: "t", hook: "store", scenes: [{ seconds: 4, visual: "v", voiceover: "x" }] }));
  assert.equal(s.hook, "store");
  assert.equal(parseScript(JSON.stringify({ title: "t", hook: "bogus", scenes: [{ seconds: 4, visual: "v", voiceover: "x" }] })).hook, undefined);
});
