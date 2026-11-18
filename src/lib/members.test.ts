import { test } from "node:test";
import assert from "node:assert/strict";
import {
  memberNext,
  newInviteCode,
  normalizeEmail,
  normalizeHandle,
  normalizeInviteCode,
  normalizePhone,
  normalizeTiktok,
  passwordProblem,
  rewardsMissing,
} from "./members.ts";

test("emails are trimmed, lowercased and checked", () => {
  assert.equal(normalizeEmail("  Sam@Example.COM "), "sam@example.com");
  assert.equal(normalizeEmail("nope"), null);
  assert.equal(normalizeEmail("a@b"), null);
  assert.equal(normalizeEmail(5), null);
});

test("passwords need 8 to 72 characters", () => {
  assert.ok(passwordProblem("short"));
  assert.equal(passwordProblem("longenough"), null);
  assert.ok(passwordProblem("x".repeat(73)));
});

test("handles and invite codes", () => {
  assert.equal(normalizeHandle("@Pantry_Pro"), "pantry_pro");
  assert.equal(normalizeHandle("ab"), null);
  assert.equal(normalizeHandle("has space"), null);
  assert.equal(normalizeInviteCode(" abcd-2345 "), "ABCD2345");
  assert.equal(normalizeInviteCode("abc"), null);
  assert.equal(normalizeInviteCode(""), null);
});

test("phone numbers become E.164, bare 10 digits are US", () => {
  assert.equal(normalizePhone("(704) 555-0123"), "+17045550123");
  assert.equal(normalizePhone("1 704 555 0123"), "+17045550123");
  assert.equal(normalizePhone("+977 980-1234567"), "+9779801234567");
  assert.equal(normalizePhone("555-0123"), null);
  assert.equal(normalizePhone("+0123456789"), null);
});

test("TikTok handles accept @, links and dots", () => {
  assert.equal(normalizeTiktok("@FooddieScanner"), "fooddiescanner");
  assert.equal(normalizeTiktok("https://www.tiktok.com/@snack.check?lang=en"), "snack.check");
  assert.equal(normalizeTiktok("ends."), null);
  assert.equal(normalizeTiktok("x"), null);
});

test("invite codes avoid look-alike characters", () => {
  const code = newInviteCode(8);
  assert.match(code, /^[A-HJKMNP-Z2-9]{8}$/);
  assert.equal(newInviteCode(3, () => 0), "AAA");
});

test("rewards need confirmed email, phone and TikTok", () => {
  assert.deepEqual(rewardsMissing({ emailConfirmed: false, phone: null, tiktok: null }), ["email", "phone", "tiktok"]);
  assert.deepEqual(rewardsMissing({ emailConfirmed: true, phone: "+17045550123", tiktok: "me" }), []);
});

test("memberNext keeps redirects on-site", () => {
  assert.equal(memberNext("/me"), "/me");
  assert.equal(memberNext("//evil.com"), "/me");
  assert.equal(memberNext("/api/x"), "/me");
  assert.equal(memberNext(null), "/me");
});
