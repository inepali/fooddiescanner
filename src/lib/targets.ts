// Products to scan (the scan_targets table): rules shared by the admin list, the script's
// "Scan this next" pick and the members' "Wanted next" card. Client-safe, unit tested.

export type TargetStatus = "todo" | "next" | "scanned" | "skipped";
export const TARGET_STATUSES: { id: TargetStatus; label: string }[] = [
  { id: "next", label: "Wanted next" },
  { id: "todo", label: "To do" },
  { id: "scanned", label: "Scanned" },
  { id: "skipped", label: "Skipped" },
];
export const STORES = ["Costco", "Sam's Club", "Walmart", "Aldi", "Lidl", "Target", "Kroger", "Trader Joe's", "Any"] as const;

export type Target = {
  id: string;
  product: string;
  store: string;
  category: string;
  compare_group: string | null;
  priority: number;
  status: TargetStatus;
  scan_id: string | null;
};

/** How many "Wanted next" products members see. */
export const WANTED_SHOWN = 5;

export function parseStatus(v: unknown): TargetStatus | null {
  return TARGET_STATUSES.find((s) => s.id === v)?.id ?? null;
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** A new product typed by the admin, or an error message. */
export function cleanTarget(input: unknown): { product: string; store: string; category: string; compare_group: string | null; priority: number } | string {
  const o = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const product = text(o.product, 120);
  if (product.length < 2) return "Type the product name.";
  const store = text(o.store, 40) || "Any";
  const category = text(o.category, 40) || "Other";
  const group = text(o.compare_group, 40).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const p = Math.round(Number(o.priority));
  return { product, store, category, compare_group: group || null, priority: Number.isFinite(p) ? Math.min(100, Math.max(0, p)) : 50 };
}

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w.length > 1 && !["the", "and", "of", "with"].includes(w));

/**
 * Does a scanned product's name match a list item? True when every meaningful word of the
 * shorter name appears in the longer one ("Rao's Tomato Basil" ~ "Rao's Homemade Tomato Basil").
 */
export function sameProduct(a: string, b: string): boolean {
  const wa = words(a);
  const wb = words(b);
  if (wa.length === 0 || wb.length === 0) return false;
  const [short, long] = wa.length <= wb.length ? [wa, new Set(wb)] : [wb, new Set(wa)];
  return short.length >= 2 && short.every((w) => long.has(w));
}

/**
 * The list the script prompt picks "Scan this next" from: direct rivals of this product (same compare
 * group, then category) and wanted-next items rank first, then the highest priority. Refs T1, T2… map back to ids.
 */
export function candidatesFor(targets: Target[], product: Target | null, max = 30): (Target & { ref: string })[] {
  const open = targets.filter((t) => t.status === "next" || t.status === "todo");
  const rank = (t: Target) =>
    (t.status === "next" ? 300 : 0) +
    (product && t.compare_group && t.compare_group === product.compare_group ? 200 : 0) +
    (product && t.category === product.category ? 100 : 0) +
    t.priority;
  return open
    .filter((t) => t.id !== product?.id)
    .sort((a, b) => rank(b) - rank(a))
    .slice(0, max)
    .map((t, i) => ({ ...t, ref: `T${i + 1}` }));
}
