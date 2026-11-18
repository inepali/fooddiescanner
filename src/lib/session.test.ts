import { test } from "node:test";
import assert from "node:assert/strict";
import { createSession, safeNext, verifySession } from "./session.ts";

test("a fresh session verifies with the same password", async () => {
  const t = await createSession("pw");
  assert.equal(await verifySession("pw", t), true);
});

test("a session is rejected with a different password", async () => {
  const t = await createSession("pw");
  assert.equal(await verifySession("other", t), false);
});

test("an expired session is rejected", async () => {
  const t = await createSession("pw", Date.now() - 40 * 86_400_000, 30);
  assert.equal(await verifySession("pw", t), false);
});

test("a tampered expiry is rejected", async () => {
  const t = await createSession("pw");
  const [, sig] = t.split(".");
  assert.equal(await verifySession("pw", `${Date.now() + 999 * 86_400_000}.${sig}`), false);
});

test("missing or junk tokens are rejected", async () => {
  assert.equal(await verifySession("pw", undefined), false);
  assert.equal(await verifySession("pw", "nope"), false);
  assert.equal(await verifySession("pw", ".abc"), false);
});

test("safeNext keeps same-site paths and blocks the rest", () => {
  assert.equal(safeNext("/scans/abc?x=1"), "/scans/abc?x=1");
  assert.equal(safeNext("//evil.com"), "/scan");
  assert.equal(safeNext("/\\evil.com"), "/scan");
  assert.equal(safeNext("https://evil.com"), "/scan");
  assert.equal(safeNext("/login"), "/scan");
  assert.equal(safeNext(undefined), "/scan");
});

test("admin emails and secret come from env", async () => {
  const { adminEmails, adminGuarded, sessionSecret } = await import("./session.ts");
  assert.deepEqual(adminEmails({ ADMIN_EMAILS: " A@x.com, b@y.com  c@z.com" }), ["a@x.com", "b@y.com", "c@z.com"]);
  assert.deepEqual(adminEmails({}), []);
  assert.equal(sessionSecret({ SESSION_SECRET: "s", APP_PASSWORD: "p" }), "s");
  assert.equal(sessionSecret({ APP_PASSWORD: "p" }), "p");
  assert.equal(adminGuarded({}), false);
});
