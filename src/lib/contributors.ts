// Admin: managing points-program members ("contributors"). Client-safe rules, unit tested.
// Tier: scanner (label scans) or creator (also sends videos). Inactive = the `banned` flag:
// they can't sign in, and nothing they send earns points (see 0015 / 0019).

export type Tier = "scanner" | "creator";
export const TIER_LABEL: Record<Tier, string> = { scanner: "Scanner", creator: "Video creator" };

export type Contributor = {
  id: string;
  handle: string | null;
  email: string | null;
  tiktok: string | null;
  phone: string | null;
  tier: Tier;
  active: boolean;
  joined: string;
  points: number;
  scans: number;
  videos: number;
  pending: number;
  lastSubmitted: string | null;
};

/** What the admin may change: tier and/or active. Null when the body has neither (or bad values). */
export function parseContributorPatch(input: unknown): { tier?: Tier; banned?: boolean } | null {
  const o = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const out: { tier?: Tier; banned?: boolean } = {};
  if (o.tier !== undefined) {
    if (o.tier !== "scanner" && o.tier !== "creator") return null;
    out.tier = o.tier;
  }
  if (o.active !== undefined) {
    if (typeof o.active !== "boolean") return null;
    out.banned = !o.active;
  }
  return Object.keys(out).length ? out : null;
}

type Sub = { creator_id: string; submission_kind: string | null; review_status: string | null; submitted_at: string | null };

/** Per-member totals from their submissions and points ledger rows. */
export function summarize(subs: Sub[], ledger: { creator_id: string; points: number }[]) {
  const by = new Map<string, { points: number; scans: number; videos: number; pending: number; lastSubmitted: string | null }>();
  const get = (id: string) => {
    let v = by.get(id);
    if (!v) by.set(id, (v = { points: 0, scans: 0, videos: 0, pending: 0, lastSubmitted: null }));
    return v;
  };
  for (const l of ledger) get(l.creator_id).points += Number(l.points) || 0;
  for (const s of subs) {
    if (!s.submitted_at) continue;
    const v = get(s.creator_id);
    if (s.submission_kind === "video") v.videos++;
    else v.scans++;
    if (s.review_status === "pending" || s.review_status === null) v.pending++;
    if (!v.lastSubmitted || s.submitted_at > v.lastSubmitted) v.lastSubmitted = s.submitted_at;
  }
  return by;
}
