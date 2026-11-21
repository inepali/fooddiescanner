import { test } from "node:test";
import assert from "node:assert/strict";
import { parseContributorPatch, summarize } from "./contributors.ts";

test("parseContributorPatch takes tier and active only", () => {
  assert.deepEqual(parseContributorPatch({ tier: "creator" }), { tier: "creator" });
  assert.deepEqual(parseContributorPatch({ active: false }), { banned: true });
  assert.deepEqual(parseContributorPatch({ tier: "scanner", active: true }), { tier: "scanner", banned: false });
  assert.equal(parseContributorPatch({ tier: "admin" }), null);
  assert.equal(parseContributorPatch({ active: "no" }), null);
  assert.equal(parseContributorPatch({}), null);
});

test("summarize counts scans, videos, waiting and points per member", () => {
  const out = summarize(
    [
      { creator_id: "a", submission_kind: "scan", review_status: "approved", submitted_at: "2026-11-01T00:00:00Z" },
      { creator_id: "a", submission_kind: "video", review_status: "pending", submitted_at: "2026-11-03T00:00:00Z" },
      { creator_id: "a", submission_kind: "scan", review_status: null, submitted_at: null }, // a draft: ignored
    ],
    [
      { creator_id: "a", points: 30 },
      { creator_id: "a", points: -10 },
      { creator_id: "b", points: 5 },
    ],
  );
  assert.deepEqual(out.get("a"), { points: 20, scans: 1, videos: 1, pending: 1, lastSubmitted: "2026-11-03T00:00:00Z" });
  assert.equal(out.get("b")?.points, 5);
});
