import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_CUT, planCompare, type FootageSource } from "./compare-timeline.ts";

const v = (file: string, length: number): FootageSource => ({ kind: "video", file, length });

test("each scene shows its own product's footage, long scenes split into cuts", () => {
  const plan = planCompare(
    [
      { seconds: 5, voiceover: "a", product: null },
      { seconds: 20, voiceover: "b", product: 1 },
      { seconds: 10, voiceover: "c", product: 2 },
    ],
    [],
    35,
    [[v("p1a", 30), v("p1b", 4)], [v("p2", 12)]],
  );
  assert.ok(plan.every((s) => s.end - s.start <= MAX_CUT + 1e-6));
  assert.equal(plan[plan.length - 1].end, 35);
  const p1 = plan.filter((s) => s.product === 1);
  assert.ok(p1.length >= 3 && p1.every((s) => s.shown === 1));
  // Alternates clips, and the second use of p1a continues where the first stopped.
  for (let i = 1; i < p1.length; i++) assert.notEqual(p1[i].source.file, p1[i - 1].source.file);
  const reused = plan.filter((s) => s.source.file === "p1a");
  assert.ok(reused.length >= 2 && reused[1].offset > 0);
  assert.ok(plan.filter((s) => s.product === 2).every((s) => s.shown === 2));
});

test("a product without footage borrows another's; no footage at all = empty plan", () => {
  const plan = planCompare([{ seconds: 5, voiceover: "x", product: 2 }], [], 5, [[v("p1", 10)], []]);
  assert.equal(plan[0].shown, 1);
  assert.deepEqual(planCompare([{ seconds: 5, voiceover: "x", product: 1 }], [], 5, [[], []]), []);
});

test("offset wraps back to the start near the end of a clip", () => {
  const plan = planCompare(
    [{ seconds: 27, voiceover: "x", product: 1 }],
    [],
    27,
    [[v("short", 10)]],
  );
  assert.deepEqual(plan.map((s) => s.offset), [0, 9, 0]);
});
