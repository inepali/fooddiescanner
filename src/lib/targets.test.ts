import { test } from "node:test";
import assert from "node:assert/strict";
import { candidatesFor, cleanTarget, parseStatus, sameProduct, type Target } from "./targets.ts";

const t = (id: string, product: string, extra: Partial<Target> = {}): Target => ({
  id,
  product,
  store: "Any",
  category: "Cookies",
  compare_group: "sandwich-cookies",
  priority: 50,
  status: "todo",
  scan_id: null,
  ...extra,
});

test("sameProduct matches the same product written two ways, not a different one", () => {
  assert.equal(sameProduct("Rao's Tomato Basil", "Rao's Homemade Tomato Basil"), true);
  assert.equal(sameProduct("OREO Chocolate Sandwich Cookies", "Oreo Chocolate Sandwich Cookies"), true);
  assert.equal(sameProduct("Oreo", "Oreo Chocolate Sandwich Cookies"), false); // one word is too loose
  assert.equal(sameProduct("Chips Ahoy Original", "Oreo Chocolate Sandwich Cookies"), false);
});

test("candidates: rivals and wanted first, then priority; never the product itself or scanned ones", () => {
  const oreo = t("o", "Oreo", { status: "scanned" });
  const list = [
    oreo,
    t("a", "Benton's", { priority: 60 }),
    t("b", "Lay's", { category: "Chips", compare_group: "potato-chips", priority: 95 }),
    t("c", "Prego", { category: "Pasta sauce", compare_group: "pasta-sauce", status: "next", priority: 10 }),
    t("d", "Skipped", { status: "skipped" }),
  ];
  const out = candidatesFor(list, oreo);
  assert.deepEqual(out.map((x) => x.id), ["a", "c", "b"]);
  assert.deepEqual(out.map((x) => x.ref), ["T1", "T2", "T3"]);
});

test("cleanTarget and parseStatus", () => {
  assert.equal(cleanTarget({ product: "x" }), "Type the product name.");
  assert.deepEqual(cleanTarget({ product: " Jif  Creamy ", compare_group: "Peanut Butter!", priority: 140 }), {
    product: "Jif Creamy",
    store: "Any",
    category: "Other",
    compare_group: "peanut-butter",
    priority: 100,
  });
  assert.equal(parseStatus("next"), "next");
  assert.equal(parseStatus("done"), null);
});
