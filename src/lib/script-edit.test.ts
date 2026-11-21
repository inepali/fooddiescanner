import { test } from "node:test";
import assert from "node:assert/strict";
import { applyEdits, parseRefine, secondsFor } from "./script-edit.ts";
import { ensureHook, fixCounts, parseScript, type VideoScript } from "./script.ts";

const saved: VideoScript = {
  title: "Oreo, honestly",
  scenes: [
    { seconds: 4, visual: "pack on shelf", voiceover: "Looks harmless, right?", section: "hook", photo: 1 },
    { seconds: 8, visual: "close up", voiceover: "Sugar is number two on the label.", section: "poor" },
    { seconds: 6, visual: "hand", voiceover: "Do you eat this? Comment your answer.", section: "outro" },
  ],
  next: { product: "Chips Ahoy", why: "Same aisle", teaser: "Tomorrow: Chips Ahoy." },
};

test("applyEdits keeps untouched lines, marks changed and new ones, drops emptied ones", () => {
  const out = applyEdits(saved, {
    title: "  ",
    scenes: [
      { from: 0, voiceover: "Looks harmless, right?" },
      { from: 1, voiceover: "Sugar is number two. That's a lot of sugar for one cookie." },
      { section: "poor", voiceover: "I bought these at Costco." },
      { from: 2, voiceover: "" },
    ],
  });
  assert.equal(out.title, "Oreo, honestly"); // blank title keeps the old one
  assert.equal(out.scenes.length, 3);
  assert.deepEqual(out.scenes[0], saved.scenes[0]); // untouched: same visual, photo, seconds, no flag
  assert.equal(out.scenes[1].edited, true);
  assert.equal(out.scenes[1].visual, "close up");
  assert.equal(out.scenes[1].seconds, secondsFor(out.scenes[1].voiceover));
  assert.equal(out.scenes[2].edited, true);
  assert.equal(out.next?.product, "Chips Ahoy");
  assert.throws(() => applyEdits(saved, { scenes: [{ voiceover: " " }] }));
});

test("edited lines survive the count fixer and the closing-line check", () => {
  const s: VideoScript = { title: "T", scenes: [{ seconds: 5, visual: "v", voiceover: "My five worst picks. Bye.", edited: true }] };
  assert.equal(fixCounts(s, 3, 1).scenes[0].voiceover, "My five worst picks. Bye.");
  assert.equal(ensureHook(s), s);
});

test("parseRefine changes one line or every line, and rejects a changed line count", () => {
  const one = parseRefine('{"voiceover":"Sugar is second. So: lots of it."}', { script: saved, scene: 1, productName: "Oreo", ingredients: [] });
  assert.equal(one.scenes[1].voiceover, "Sugar is second. So: lots of it.");
  assert.equal(one.scenes[1].edited, true);
  assert.deepEqual(one.scenes[0], saved.scenes[0]);
  const all = parseRefine('{"lines":["A?","B.","C? Comment your answer."]}', { script: saved, productName: null, ingredients: [] });
  assert.deepEqual(all.scenes.map((s) => s.voiceover), ["A?", "B.", "C? Comment your answer."]);
  assert.throws(() => parseRefine('{"lines":["only one"]}', { script: saved, productName: null, ingredients: [] }));
});

test("parseScript reads tomorrow's scan and keeps it through a save", () => {
  const out = parseScript('{"title":"T","scenes":[{"seconds":4,"visual":"a","voiceover":"x"}],"next_scan":{"product":"Rao\'s Marinara","why":"Same brand","teaser":"Tomorrow: the marinara."}}');
  assert.equal(out.next?.product, "Rao's Marinara");
  assert.equal(parseScript(JSON.stringify(out)).next?.teaser, "Tomorrow: the marinara.");
  assert.equal(parseScript('{"title":"T","scenes":[{"seconds":4,"visual":"a","voiceover":"x"}],"next_scan":{"why":"no product"}}').next, undefined);
});

test("tomorrow's scan keeps its list id through a save, and reads a model ref", () => {
  const id = "0b0f7a2e-1111-4a4a-9c9c-123456789abc";
  const saved = parseScript(JSON.stringify({ title: "T", scenes: [{ seconds: 4, visual: "a", voiceover: "x" }], next: { product: "P", why: "", teaser: "", store: "Aldi", targetId: id } }));
  assert.equal(saved.next?.targetId, id);
  assert.equal(saved.next?.store, "Aldi");
  const fromModel = parseScript('{"title":"T","scenes":[{"seconds":4,"visual":"a","voiceover":"x"}],"next_scan":{"target":"T4","product":"P","store":"Costco","why":"w","teaser":"t"}}');
  assert.equal(fromModel.next?.targetId, "T4");
});
