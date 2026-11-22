import { test } from "node:test";
import assert from "node:assert/strict";
import { contactEmail, isBot, parseContact } from "./contact.ts";

test("parseContact cleans and accepts a good message", () => {
  const r = parseContact({ name: "  Jane   Doe ", email: " Jane@Example.com ", message: "Hello there, a question.\r\n" });
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.value, { name: "Jane Doe", email: "jane@example.com", message: "Hello there, a question." });
});

test("parseContact rejects missing or bad fields", () => {
  assert.equal(parseContact({ email: "a@b.co", message: "long enough message" }).ok, false);
  assert.equal(parseContact({ name: "A", email: "nope", message: "long enough message" }).ok, false);
  assert.equal(parseContact({ name: "A", email: "a@b.co", message: "short" }).ok, false);
  assert.equal(parseContact({ name: "A", email: "a@b.co", message: "x".repeat(5001) }).ok, false);
});

test("isBot catches the honeypot", () => {
  assert.equal(isBot({ company: "Acme" }), true);
  assert.equal(isBot({ company: "" }), false);
  assert.equal(isBot({}), false);
});

test("contactEmail escapes HTML and sets reply_to", () => {
  const m = contactEmail({ name: "Eve\n<b>", email: "eve@x.co", message: "<script>hi</script>" }, "support@x.co", "F <n@x.co>");
  assert.equal(m.reply_to, "eve@x.co");
  assert.deepEqual(m.to, ["support@x.co"]);
  assert.ok(!m.subject.includes("\n"));
  assert.ok(!m.html.includes("<script>"));
  assert.ok(m.html.includes("&lt;script&gt;"));
});
