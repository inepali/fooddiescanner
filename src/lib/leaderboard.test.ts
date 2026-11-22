import { test } from "node:test";
import assert from "node:assert/strict";
import { rankLeaders } from "./leaderboard.ts";

test("ranks high to low, ties share a place", () => {
  const out = rankLeaders([
    { handle: "cara", points: 100 },
    { handle: "ana", points: 500 },
    { handle: "ben", points: 300 },
    { handle: "abe", points: 300 },
  ]);
  assert.deepEqual(
    out.map((r) => [r.rank, r.handle]),
    [[1, "ana"], [2, "abe"], [2, "ben"], [4, "cara"]],
  );
});

test("drops members with no username or no points", () => {
  const out = rankLeaders([
    { handle: null, points: 900 },
    { handle: "zero", points: 0 },
    { handle: "neg", points: -10 },
    { handle: "ok", points: 10 },
  ]);
  assert.deepEqual(out.map((r) => r.handle), ["ok"]);
});

test("keeps only the top ten", () => {
  const rows = Array.from({ length: 15 }, (_, i) => ({ handle: `m${String(i).padStart(2, "0")}`, points: 1000 - i }));
  const out = rankLeaders(rows);
  assert.equal(out.length, 10);
  assert.equal(out[9].handle, "m09");
});
