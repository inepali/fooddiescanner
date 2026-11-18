import { test } from "node:test";
import assert from "node:assert/strict";
import { dailyScanLimit, missingParts, videoLengthProblem } from "./member-scan.ts";

test("daily scan limit defaults to 5 and is capped", () => {
  assert.equal(dailyScanLimit(undefined), 5);
  assert.equal(dailyScanLimit("12"), 12);
  assert.equal(dailyScanLimit("0"), 5);
  assert.equal(dailyScanLimit("junk"), 5);
  assert.equal(dailyScanLimit("5000"), 100);
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
