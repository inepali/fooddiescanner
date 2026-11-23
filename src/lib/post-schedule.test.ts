import test from "node:test";
import assert from "node:assert/strict";
import { localDate, slotLabel, suggestSlots, tzOffsetMinutes, zonedTime } from "./post-schedule.ts";

test("time zone helpers handle EST, EDT and the day boundary", () => {
  assert.equal(tzOffsetMinutes(Date.UTC(2026, 10, 23, 12)), -300); // Nov: EST
  assert.equal(tzOffsetMinutes(Date.UTC(2026, 6, 1, 12)), -240); // Jul: EDT
  assert.equal(zonedTime(2026, 11, 25, 10).toISOString(), "2026-11-25T15:00:00.000Z");
  assert.equal(zonedTime(2026, 7, 1, 16).toISOString(), "2026-07-01T20:00:00.000Z");
  // 2026-11-24 03:00 UTC is still Monday Nov 23 in New York.
  assert.deepEqual(localDate(Date.UTC(2026, 10, 24, 3)), { y: 2026, m: 11, d: 23, day: 1 });
  assert.equal(slotLabel(new Date("2026-11-25T15:00:00Z")), "Wed, Nov 25 · 10:00 AM ET");
});

test("TikTok on a Monday morning: suggests the strongest slots in the next 4 days", () => {
  const now = new Date("2026-11-23T10:41:00Z"); // Mon 5:41 AM ET
  const s = suggestSlots("tiktok", now);
  assert.equal(s.length, 3);
  // Best three within 96h are Wed 10 AM, Wed 6 PM and Thu 10 AM; Thu 10 AM is the top one.
  assert.deepEqual(s.map((x) => x.label), ["Wed, Nov 25 · 10:00 AM ET", "Wed, Nov 25 · 6:00 PM ET", "Thu, Nov 26 · 10:00 AM ET"]);
  assert.equal(s.filter((x) => x.recommended).length, 1);
  assert.equal(s.find((x) => x.recommended)?.label, "Thu, Nov 26 · 10:00 AM ET");
  assert.equal(s.find((x) => x.recommended)?.strength, 100);
  // Time order.
  assert.ok(s.every((x, i) => i === 0 || x.at > s[i - 1].at));
});

test("YouTube picks the 4 PM peak and respects the lead time", () => {
  const now = new Date("2026-11-25T20:45:00Z"); // Wed 3:45 PM ET — 4 PM is too soon (30 min lead)
  const s = suggestSlots("youtube", now, [], { count: 1 });
  assert.equal(s[0].label, "Thu, Nov 26 · 4:00 PM ET");
});

test("taken slots push suggestions away by the minimum gap", () => {
  const now = new Date("2026-11-23T10:41:00Z");
  const taken = [new Date("2026-11-26T15:00:00Z")]; // Thu 10 AM already booked
  const s = suggestSlots("tiktok", now, taken);
  assert.ok(!s.some((x) => x.at === "2026-11-26T15:00:00.000Z"));
  // Thu noon is within 5h of the booking, so it's skipped too.
  assert.ok(!s.some((x) => x.at === "2026-11-26T17:00:00.000Z"));
  assert.equal(s.find((x) => x.recommended)?.label, "Wed, Nov 25 · 10:00 AM ET");
});
