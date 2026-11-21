import { test } from "node:test";
import assert from "node:assert/strict";
import { wordsFromAlignment } from "./captions.ts";
import { isMock, mockAlignment, silentWav, speechSeconds } from "./mock.ts";
import { mergeHashtags, normalizeHashtags, parseCopy, AI_NOTE, CTA, OFF_CREDIT } from "./copy.ts";
import { narration, parseScript } from "./script.ts";

test("wordsFromAlignment groups characters into timed words", () => {
  const chars = [..."Hi there"];
  const words = wordsFromAlignment({
    characters: chars,
    character_start_times_seconds: chars.map((_, i) => i * 0.1),
    character_end_times_seconds: chars.map((_, i) => (i + 1) * 0.1),
  });
  assert.equal(words.length, 2);
  assert.equal(words[0].text, "Hi");
  assert.equal(words[0].start, 0);
  assert.ok(Math.abs(words[0].end - 0.2) < 1e-9);
  assert.equal(words[1].text, "there");
  assert.ok(Math.abs(words[1].start - 0.3) < 1e-9);
  assert.ok(Math.abs(words[1].end - 0.8) < 1e-9);
});

test("wordsFromAlignment ignores repeated and trailing spaces", () => {
  const chars = [..."a  b "];
  const words = wordsFromAlignment({
    characters: chars,
    character_start_times_seconds: chars.map((_, i) => i),
    character_end_times_seconds: chars.map((_, i) => i + 1),
  });
  assert.deepEqual(words.map((w) => w.text), ["a", "b"]);
});

test("mock audio is a valid silent WAV of the right length", () => {
  const wav = silentWav(2);
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.toString("ascii", 8, 12), "WAVE");
  assert.equal(wav.length, 44 + 2 * 8000 * 2);
  assert.equal(wav.readUInt32LE(40), 2 * 8000 * 2);
  assert.ok(wav.subarray(44).every((b) => b === 0));
});

test("mock alignment spans the duration and yields one word per word", () => {
  const text = "Hello big world";
  const a = mockAlignment(text, 3);
  assert.equal(a.characters.length, text.length);
  assert.ok(Math.abs(a.character_end_times_seconds.at(-1)! - 3) < 1e-9);
  assert.equal(wordsFromAlignment(a).length, 3);
});

test("speechSeconds is about 2.5 words per second", () => {
  assert.equal(speechSeconds("one two three four five six seven eight nine ten"), 4);
  assert.equal(speechSeconds(""), 1);
});

test("isMock reads MOCK_AI", () => {
  const before = process.env.MOCK_AI;
  process.env.MOCK_AI = "true";
  assert.equal(isMock(), true);
  process.env.MOCK_AI = "false";
  assert.equal(isMock(), false);
  if (before === undefined) delete process.env.MOCK_AI;
  else process.env.MOCK_AI = before;
});

test("normalizeHashtags cleans and dedupes", () => {
  assert.deepEqual(normalizeHashtags(["#Healthy Eating", "healthyeating", "Food!", 5, ""]), [
    "healthyeating",
    "food",
  ]);
  assert.deepEqual(normalizeHashtags("nope"), []);
});

test("mergeHashtags puts up to 3 curated tags first and caps the total", () => {
  const merged = mergeHashtags(["a", "b", "c", "d", "e", "f"], ["x", "y", "z", "w"], 8);
  assert.deepEqual(merged, ["x", "y", "z", "a", "b", "c", "d", "e"]);
});

test("parseCopy truncates, cleans hashtags and appends the AI note", () => {
  const out = parseCopy(
    '```json\n{"tiktok": {"title": "' + "T".repeat(150) + '", "description": "Short.", "hashtags": ["#Snacks", "snacks", "Label Check"]}, ' +
      '"instagram": {"title": "Ig", "description": "", "hashtags": []}}\n```',
  );
  assert.equal(out.tiktok.title.length, 100);
  assert.equal(out.tiktok.description, `Short.\n\n${CTA}\n\n${AI_NOTE}`);
  assert.deepEqual(out.tiktok.hashtags, ["snacks", "labelcheck"]);
  assert.equal(out.instagram.description, `${CTA}\n\n${AI_NOTE}`);
  const withOff = parseCopy('{"tiktok": {"title": "t", "description": "d", "hashtags": []}, "instagram": {"title": "i", "description": "", "hashtags": []}}', true);
  assert.equal(withOff.tiktok.description, `d\n\n${CTA}\n\n${AI_NOTE}\n\n${OFF_CREDIT}`);
});

test("parseCopy rejects non-JSON", () => {
  assert.throws(() => parseCopy("no json here"));
});

test("narration joins every scene voiceover in order", () => {
  const script = parseScript(
    '{"title": "T", "scenes": [{"seconds": 5, "visual": "v1", "voiceover": "Hello there."},' +
      ' {"seconds": 5, "visual": "v2", "voiceover": "  Score is 42.  "}]}',
  );
  assert.equal(narration(script), "Hello there. Score is 42.");
});

import { parseVoices } from "./elevenlabs.ts";

test("parseVoices puts your own voices first, then defaults, then library voices", () => {
  const voices = parseVoices({
    voices: [
      { voice_id: "b", name: "Zed", category: "professional", labels: { accent: "british" } },
      { voice_id: "a", name: "Sarah", category: "premade", labels: { gender: "female", accent: "american" } },
      { voice_id: "c", name: "Sanjay", category: "cloned", labels: {} },
      { voice_id: "d", name: "My Pro", category: "professional", is_owner: true },
      { name: "no id" },
    ],
  });
  assert.deepEqual(
    voices.map((v) => [v.name, v.group, v.free]),
    [
      ["My Pro", "mine", true],
      ["Sanjay", "mine", true],
      ["Sarah", "default", true],
      ["Zed", "library", false],
    ],
  );
  assert.equal(voices[2].description, "female, american");
  assert.deepEqual(parseVoices(null), []);
});

import { MAX_WORDS, MIN_WORDS, buildPrompt, wrongCount, fixCounts, ensureHook, wordCount, groupFor, parseTone, pickCandidates } from "./script.ts";

const ings = [
  { name: "Water", score: 95, reason: "Hydrating." },
  { name: "Whole grain oats", score: 90, reason: "Fiber-rich whole grain." },
  { name: "Cane sugar", score: 25, reason: "Added sugar." },
  { name: "Wheat flour", score: 48, reason: "Refined flour." },
  { name: "Olive oil", score: 78, reason: "Unsaturated fats." },
  { name: "Red 40", score: 10, reason: "Synthetic dye." },
  { name: "Salt", score: 45, reason: "Sodium." },
  { name: "Palm oil", score: 30, reason: "Saturated fat." },
];

test("groupFor splits at 60 and 40", () => {
  assert.deepEqual([100, 60, 59, 40, 39, 0].map(groupFor), ["good", "good", "fair", "fair", "poor", "poor"]);
});

test("pickCandidates: best greens, worst reds, trivial water skipped", () => {
  const c = pickCandidates(ings);
  assert.deepEqual(c.good.map((x) => x.name), ["Whole grain oats", "Olive oil"]); // water dropped
  assert.deepEqual(c.poor.map((x) => x.name), ["Red 40", "Cane sugar", "Palm oil"]); // worst first
  assert.deepEqual(c.fair.map((x) => x.name), ["Wheat flour", "Salt"]); // label order
  assert.deepEqual(c.counts, { good: 3, fair: 2, poor: 3 }); // counts still include water
  assert.equal(c.poor[0].position, 6);
});

test("prompt: groups and tone in, no numeric scores, ends on a question rule", () => {
  const p = buildPrompt({ productName: "Oat Bar", overall: 52, allergens: [], ingredients: ings, tone: "playful" });
  assert.match(p, /Upbeat, witty/);
  assert.match(p, /THE TWO BEST[^]*Whole grain oats[^]*THE FIVE WORST[^]*Red 40/); // 2 good; 5 of the fair/poor ones
  assert.match(p, /COUNTS FOR THIS LABEL/);
  assert.match(p, /may be harmful for regular consumption/); // under 60: the concerning verdict
  assert.doesNotMatch(p, /VERDICT FOR THIS PRODUCT: it is mostly good/);
  assert.match(p, /Do you eat this\?/);
  assert.match(p, /never say or show any numeric score/i);
  assert.doesNotMatch(p, /\/100/);
  assert.doesNotMatch(p, /\b52\b/); // the overall number is never given to the model
  assert.match(p, /a mixed bag/);
});

test("prompt: empty group is shown as none", () => {
  const p = buildPrompt({ productName: null, overall: 90, allergens: [], ingredients: [{ name: "Oats", score: 95, reason: null }] });
  assert.match(p, /VERDICT FOR THIS PRODUCT: it is mostly good/); // 60 and over: praise, extra detail on the worse ones
  assert.match(p, /THE BEST ingredient on this label[^]*Oats \[good\][^]*THE WORST ingredients on this label[^]*\(none\)/); // one good ingredient: best only
  assert.match(p, /skip this section/);
  assert.match(p, /NO worst ingredients/);
  assert.match(p, /nothing to warn about on this label/);
  assert.doesNotMatch(p, /may be harmful for regular consumption/);
  const c = pickCandidates(ings);
  assert.deepEqual([c.best.length, c.worst.length], [2, 5]); // water skipped; best only good, worst only fair/poor
  assert.equal(c.worst[0].group, "poor");
  assert.ok(c.best[0].name !== c.worst[0].name);
});

test("pickCandidates: best only good, worst only fair/poor, five each at most, never overlap", () => {
  const mk = (scores: number[]) => scores.map((score, i) => ({ name: `I${i}`, score, reason: null }));
  const allGood = pickCandidates(mk([90, 85, 80]));
  assert.deepEqual([allGood.best.length, allGood.worst.length], [3, 0]); // nothing to worry about
  const allBad = pickCandidates(mk([30, 20, 50]));
  assert.deepEqual([allBad.best.length, allBad.worst.length], [0, 3]);
  const mixed = pickCandidates(mk([95, 90, 85, 80, 75, 70, 65, 50, 45, 30, 20, 10]));
  assert.deepEqual([mixed.best.length, mixed.worst.length], [5, 5]);
  assert.equal(mixed.worst[0].name, "I11");
  for (const c of [allGood, allBad, mixed]) {
    const names = [...c.best, ...c.worst].map((x) => x.name);
    assert.equal(new Set(names).size, names.length);
  }
  const p = buildPrompt({ productName: null, overall: 85, allergens: [], ingredients: mk([90, 85, 80, 55]) });
  assert.match(p, /the three best ingredients and the worst ingredient/);
  assert.match(p, /NOT five and five/);
  const clean = buildPrompt({ productName: null, overall: 90, allergens: [], ingredients: mk([90, 85]) });
  assert.match(clean, /never say \"worst\"/);
  const full = buildPrompt({ productName: null, overall: 50, allergens: [], ingredients: mk([95, 90, 85, 80, 75, 50, 45, 30, 20, 10]) });
  assert.match(full, /THE FIVE BEST[^]*THE FIVE WORST/);
  assert.doesNotMatch(full, /COUNTS FOR THIS LABEL/);
});

test("wrongCount catches a script that says the wrong number", () => {
  const s = (voiceover: string) => ({ title: "T", scenes: [{ seconds: 5, visual: "v", voiceover }] });
  assert.match(wrongCount(s("Now the five worst. Stay to the end."), 3, 2) ?? "", /says 5 worst/);
  assert.match(wrongCount(s("Here are the 5 best."), 2, 0) ?? "", /says 5 best/);
  assert.match(wrongCount(s("Now the ones I'd worry about."), 3, 0) ?? "", /nothing on this label/);
  assert.equal(wrongCount(s("The three best, then the two worst. Look for five ingredients or fewer."), 3, 2), null);
  assert.equal(wrongCount(s("Three clean ingredients. Nothing to worry about here."), 3, 0), null);
});

test("fixCounts corrects old scripts: real counts, and no worry talk when nothing is bad", () => {
  const sc = (...voiceovers: string[]) => ({ title: "T", scenes: voiceovers.map((voiceover) => ({ seconds: 8, visual: "v", voiceover })) });
  const milk = fixCounts(
    sc(
      "Number three: vitamin D3. It helps your body absorb calcium. Now the five I'd worry about. Stay to the end.",
      "Here's the honest part: this milk has no ingredients I'd flag as concerning. But wait until you hear what's hiding in the next one.",
      "Now the five worst.",
    ),
    3,
    0,
  );
  assert.deepEqual(milk.scenes.map((s) => s.voiceover), [
    "Number three: vitamin D3. It helps your body absorb calcium.",
    "Here's the honest part: this milk has no ingredients I'd flag as concerning.",
  ]); // the scene that was only worst talk is dropped
  const two = fixCounts(sc("The five best first. Now the five I'd worry about. Stay to the end."), 3, 2);
  assert.equal(two.scenes[0].voiceover, "The three best first. Now the two I'd worry about. Stay to the end.");
  assert.equal(wrongCount(sc("Now the five I'd worry about."), 3, 2)?.includes("5 worst"), true);
  const custom = fixCounts({ title: "T", scenes: [{ seconds: 5, visual: "v", voiceover: "My five worst picks.", custom: true }] }, 3, 0);
  assert.equal(custom.scenes[0].voiceover, "My five worst picks."); // your own lines are left alone
});

test("ensureHook ends on a question plus a like-and-comment line", () => {
  const one = (voiceover: string) => ({ title: "T", scenes: [{ seconds: 5, visual: "v", voiceover }] });
  const end = (v: string) => ensureHook(one(v)).scenes[0].voiceover;
  assert.equal(end("Skip the sugary stuff."), "Skip the sugary stuff. Do you eat this? Comment your answer.");
  assert.equal(end("Would you still eat this?"), "Would you still eat this? Comment your answer.");
  assert.equal(end('Be honest, "do you eat this?"'), 'Be honest, "do you eat this?" Comment your answer.');
  const done = one("Would you eat this? Like and comment below.");
  assert.equal(ensureHook(done), done); // already complete: untouched
});

test("parseScript keeps valid sections; parseTone falls back", () => {
  const out = parseScript(
    '{"title":"T","scenes":[{"seconds":4,"visual":"a","voiceover":"x","section":"hook"},{"seconds":4,"visual":"b","voiceover":"y","section":"nope"}]}',
  );
  assert.equal(out.scenes[0].section, "hook");
  assert.equal(out.scenes[1].section, undefined);
  assert.equal(parseTone("calm"), "calm");
  assert.equal(parseTone("shouting"), "friendly");
  assert.equal(parseTone(undefined), "friendly");
});

import { speechBody } from "./elevenlabs.ts";
import { DELIVERIES, parseDelivery } from "./delivery.ts";

test("speechBody sends the chosen delivery as ElevenLabs voice settings", () => {
  const natural = speechBody("Hi", "natural", "eleven_multilingual_v2") as { text: string; model_id: string; voice_settings: { style: number; stability: number } };
  assert.equal(natural.text, "Hi");
  assert.equal(natural.model_id, "eleven_multilingual_v2");
  assert.deepEqual(natural.voice_settings, DELIVERIES.natural.settings);
  const expressive = speechBody("Hi", "expressive") as typeof natural;
  assert.ok(expressive.voice_settings.style > natural.voice_settings.style);
  assert.ok(expressive.voice_settings.stability < natural.voice_settings.stability);
  assert.ok(DELIVERIES.steady.settings.stability > natural.voice_settings.stability);
});

test("As cloned sends no voice settings, so ElevenLabs uses the voice's own", () => {
  const body = speechBody("Hi", "original", "eleven_multilingual_v2");
  assert.equal("voice_settings" in body, false);
  assert.equal(speechBody("Hi").model_id, "eleven_v4");
  assert.equal("voice_settings" in speechBody("Hi"), false);
});

test("parseDelivery falls back to As cloned", () => {
  assert.equal(parseDelivery("steady"), "steady");
  assert.equal(parseDelivery("loud"), "original");
  assert.equal(parseDelivery(null), "original");
});

test("script prompt asks for retention hooks at 15s, 35s and the end", () => {
  const p = buildPrompt({ productName: "Oat Bar", overall: 52, allergens: [], ingredients: [{ name: "Oats", score: 95, reason: null }] });
  assert.match(p, /Hook at about 0:15/);
  assert.match(p, /Hook at about 0:35/);
  assert.match(p, /Closing hook/);
  assert.match(p, /final question/);
});

test("script prompt sets a hard 1-minute word budget", () => {
  const p = buildPrompt({ productName: "Oat Bar", overall: 52, allergens: [], ingredients: [{ name: "Oats", score: 95, reason: null }] });
  assert.match(p, new RegExp(`between ${MIN_WORDS} and ${MAX_WORDS} words`));
  assert.match(p, /55-62/);
  assert.equal(wordCount({ title: "t", scenes: [{ seconds: 5, visual: "v", voiceover: "one two three" }, { seconds: 5, visual: "v", voiceover: "four five" }] }), 5);
});

test("parseCopy returns a YouTube block, falling back to Instagram's when the model skips it", () => {
  const withYt = parseCopy('{"tiktok": {"title": "t", "description": "d", "hashtags": []}, "instagram": {"title": "i", "description": "d", "hashtags": []}, "youtube": {"title": "Yt title", "description": "yd", "hashtags": ["#Food"]}}');
  assert.equal(withYt.youtube.title, "Yt title");
  assert.deepEqual(withYt.youtube.hashtags, ["food"]);
  const tags = Array.from({ length: 30 }, (_, i) => `t${i}`);
  const lots = parseCopy(JSON.stringify({ tiktok: { title: "t", hashtags: tags }, instagram: { title: "i", hashtags: tags }, youtube: { title: "y", hashtags: tags } }));
  assert.equal(lots.youtube.hashtags.length, 25);
  assert.equal(lots.tiktok.hashtags.length, 10);
  const without = parseCopy('{"tiktok": {"title": "t", "description": "d", "hashtags": []}, "instagram": {"title": "i", "description": "d", "hashtags": []}}');
  assert.equal(without.youtube.title, "i");
});

test("prompt: a very long label is gated (summarised, reasons trimmed, no deliberating)", () => {
  const many = Array.from({ length: 60 }, (_, n) => ({ name: `Ingredient ${n}`, score: (n * 7) % 100, reason: "x".repeat(500) }));
  const p = buildPrompt({ productName: "Big Mix", overall: 50, allergens: [], ingredients: many });
  assert.match(p, /LONG LABEL: this product lists 60 ingredients/);
  assert.doesNotMatch(p, /x{161}/); // reasons are cut to 160 characters
  const short = buildPrompt({ productName: "Oats", overall: 50, allergens: [], ingredients: many.slice(0, 8) });
  assert.doesNotMatch(short, /LONG LABEL/);
  assert.match(buildPrompt({ productName: "Oats", overall: 50, allergens: [], ingredients: many.slice(0, 8) }, true), /LONG LABEL/);
});

import { nextAutoStep, secondsLeft, IDLE_SECONDS } from "./auto-advance.ts";

test("auto-advance: steps in order, video only with uploaded clips, never posts", () => {
  const st = { hasScript: false, hasAudio: false, hasCopy: false, isPublic: false, uploadedClips: 0, hasVideo: false, rendering: false };
  assert.equal(nextAutoStep(st), "script");
  assert.equal(nextAutoStep({ ...st, hasScript: true }), "voice");
  const voiced = { ...st, hasScript: true, hasAudio: true };
  assert.equal(nextAutoStep({ ...voiced, uploadedClips: 2 }), "video"); // video comes right after voice
  assert.equal(nextAutoStep(voiced), "social"); // no clips yet: skip video, keep going
  assert.equal(nextAutoStep({ ...voiced, uploadedClips: 2, rendering: true }), "social"); // copy while it renders
  assert.equal(nextAutoStep({ ...voiced, hasCopy: true }), "public");
  const ready = { ...voiced, hasCopy: true, isPublic: true };
  assert.equal(nextAutoStep(ready), null); // no clips: wait for your upload
  assert.equal(nextAutoStep({ ...ready, uploadedClips: 2 }), "video");
  assert.equal(nextAutoStep({ ...ready, uploadedClips: 2, hasVideo: true }), null); // posting stays manual
  assert.equal(secondsLeft(0), IDLE_SECONDS);
  assert.equal(secondsLeft(61_500), 59);
  assert.equal(secondsLeft(500_000), 0);
});

import { coverImagePath, coverRowsByScan, coversByScan, pickCover } from "./media.ts";

test("card photo: first product photo, else the label, else none", () => {
  const label = { kind: "label", storage_path: "l.jpg", sort_order: 0 };
  assert.equal(pickCover([]), null);
  assert.equal(pickCover([label]), "l.jpg");
  assert.equal(
    pickCover([label, { kind: "product_image", storage_path: "b.jpg", sort_order: 2 }, { kind: "product_image", storage_path: "a.jpg", sort_order: -1 }]),
    "a.jpg",
  );
  assert.equal(pickCover([{ kind: "clip", storage_path: "c.mp4", sort_order: 0 }]), null);
  const covers = coversByScan([
    { scan_id: "s1", ...label },
    { scan_id: "s2", kind: "product_image", storage_path: "p.jpg", sort_order: 0 },
    { scan_id: "s2", kind: "label", storage_path: "x.jpg", sort_order: 0 },
  ]);
  assert.deepEqual([...covers], [["s1", "l.jpg"], ["s2", "p.jpg"]]);
});

test("card photo rows keep their ids for the cached /img address", () => {
  const rows = coverRowsByScan([
    { scan_id: "s1", id: "m1", kind: "label", storage_path: "l.jpg", sort_order: 0 },
    { scan_id: "s1", id: "m2", kind: "product_image", storage_path: "p.jpg", sort_order: 1 },
  ]);
  assert.equal(rows.get("s1")?.id, "m2");
  assert.equal(coverImagePath("m2"), "/img/m2");
});
