import { test } from "node:test";
import assert from "node:assert/strict";
import { dailySubmitLimit, missingParts, nextSubmitAt, videoLengthProblem, waitText } from "./member-scan.ts";

test("one submission per 24 hours by default", () => {
  assert.equal(dailySubmitLimit(undefined), 1);
  assert.equal(dailySubmitLimit("3"), 3);
  assert.equal(dailySubmitLimit("0"), 1);
  assert.equal(dailySubmitLimit("junk"), 1);
  assert.equal(dailySubmitLimit("5000"), 100);
});

test("next submit time frees up 24 hours after the oldest one in the window", () => {
  const H = 3_600_000;
  const now = 100 * H;
  assert.equal(nextSubmitAt([], 1, now), null);
  assert.equal(nextSubmitAt([now - 25 * H], 1, now), null);
  assert.equal(nextSubmitAt([now - 20 * H], 1, now), now + 4 * H);
  assert.equal(nextSubmitAt([now - 20 * H, now - 2 * H], 2, now), now + 4 * H);
  assert.equal(nextSubmitAt([now - 20 * H, now - 2 * H], 3, now), null);
  assert.equal(waitText(now + 4 * H, now), "in 4 h");
  assert.equal(waitText(now + 10 * 60_000, now), "in 10 min");
});

test("videos must be about a minute", () => {
  assert.equal(videoLengthProblem(60), null);
  assert.equal(videoLengthProblem(45), null);
  assert.equal(videoLengthProblem(75), null);
  assert.match(videoLengthProblem(20) ?? "", /at least 45/);
  assert.match(videoLengthProblem(120) ?? "", /75 s max/);
  assert.ok(videoLengthProblem(NaN));
  assert.ok(videoLengthProblem("x"));
});

test("missing parts come back in order", () => {
  assert.deepEqual(missingParts([]), ["label", "product_image", "product_video"]);
  assert.deepEqual(missingParts(["product_video", "label"]), ["product_image"]);
  assert.deepEqual(missingParts(["label", "product_image", "product_video", "clip"]), []);
});
