import { test } from "node:test";
import assert from "node:assert/strict";
import { VIDEO_DISCLAIMER, withDisclaimer } from "./disclaimer.ts";
import { withPublicLink } from "./public-link.ts";
import { buildAss } from "./captions.ts";
import { parseCopy } from "./copy.ts";

test("new captions carry the full disclaimer before the data credit", () => {
  const out = parseCopy('{"tiktok":{"title":"t","description":"Body"}}', true).tiktok.description;
  assert.ok(out.includes(VIDEO_DISCLAIMER));
  assert.ok(out.indexOf(VIDEO_DISCLAIMER) < out.indexOf("Grades and nutrition data"));
});

test("withDisclaimer upgrades old notes, adds it once, and keeps the credit last", () => {
  const old = "Body\n\nDo you eat this?\n\nOur opinion of the ingredient list, for information only. Not medical advice.\n\nGrades and nutrition data: Open Food Facts (ODbL)";
  const up = withDisclaimer(old);
  assert.ok(up.includes(VIDEO_DISCLAIMER));
  assert.doesNotMatch(up, /Our opinion of the ingredient list/);
  assert.equal(withDisclaimer(up), up);
  assert.equal(withDisclaimer("Body\n\nProduct data: Open Food Facts"), `Body\n\n${VIDEO_DISCLAIMER}\n\nProduct data: Open Food Facts`);
  assert.equal(withDisclaimer("Body"), `Body\n\n${VIDEO_DISCLAIMER}`);
});

test("public link goes right after the full disclaimer", () => {
  const out = withPublicLink(withDisclaimer("Body\n\nProduct data: Open Food Facts"), "https://x.app/p/1");
  assert.equal(out, `Body\n\n${VIDEO_DISCLAIMER}\n\nFull ingredient breakdown: https://x.app/p/1\n\nProduct data: Open Food Facts`);
});

test("video subtitles show the disclaimer over the last seconds", () => {
  const ass = buildAss({ words: [], duration: 40, fontName: "X" });
  assert.match(ass, /Style: Disclaimer,/);
  assert.match(ass, /Dialogue: 2,0:00:35\.00,0:00:40\.00,Disclaimer,/);
  assert.ok(ass.includes("Brand names and trademarks belong to their owners"));
  assert.doesNotMatch(buildAss({ words: [], duration: 40, fontName: "X", disclaimer: "" }), /,Disclaimer,/);
});
