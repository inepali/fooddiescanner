import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acceptedMessage,
  canSubmit,
  dailySubmitLimit,
  missingParts,
  nextSubmitAt,
  normalizeProductName,
  partsFor,
  submissionKind,
  videoLengthProblem,
  waitText,
} from "./member-scan.ts";

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

test("scans and videos need different parts, in order", () => {
  assert.deepEqual(missingParts([]), ["label", "product_image"]);
  assert.deepEqual(missingParts([], "scan"), ["label", "product_image"]);
  assert.deepEqual(missingParts(["product_image"], "scan"), ["label"]);
  assert.deepEqual(missingParts(["label", "product_image", "clip"], "scan"), []);
  assert.deepEqual(missingParts([], "video"), ["product_image", "product_video"]);
  assert.deepEqual(missingParts(["label", "product_video"], "video"), ["product_image"]);
  assert.deepEqual(missingParts(["product_image", "product_video"], "video"), []);
  assert.deepEqual(partsFor("video").map((p) => p.id), ["product_image", "product_video"]);
});

test("submission kind, who may send videos, product names", () => {
  assert.equal(submissionKind("video"), "video");
  assert.equal(submissionKind(undefined), "scan");
  assert.equal(submissionKind("junk"), "scan");
  assert.equal(canSubmit("scan", "scanner"), true);
  assert.equal(canSubmit("video", "scanner"), false);
  assert.equal(canSubmit("video", "creator"), true);
  assert.equal(normalizeProductName("  Cheez   Its  "), "Cheez Its");
  assert.equal(normalizeProductName("x"), null);
  assert.equal(normalizeProductName("a".repeat(81)), null);
  assert.equal(normalizeProductName(5), null);
});

test("accepted notices name the product", () => {
  assert.match(acceptedMessage("video", "Oreos"), /video for Oreos was accepted/);
  assert.match(acceptedMessage("scan", null), /scan of your product was accepted/);
});
