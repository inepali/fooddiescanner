import AppShell from "@/components/AppShell";
import ContributorManager from "@/components/ContributorManager";
import LargeTitle from "@/components/LargeTitle";
import ReviewTabs from "@/components/ReviewTabs";
import { summarize, type Contributor, type Tier } from "@/lib/contributors";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Admin: every rewards member, with tier (upgrade / downgrade) and active / inactive. */
export default async function ContributorsPage() {
  const db = supabase();
  const [{ data: people, error }, { data: subs }, { data: ledger }, users] = await Promise.all([
    db.from("creators").select("id, handle, tier, banned, phone, tiktok_handle, created_at").order("created_at", { ascending: false }).limit(1000),
    db.from("scans").select("creator_id, submission_kind, review_status, submitted_at").not("creator_id", "is", null).limit(20000),
    db.from("points_ledger").select("creator_id, points").limit(50000),
    db.auth.admin.listUsers({ perPage: 1000 }),
  ]);
  if (error) throw new Error(`Could not load contributors: ${error.message}`);
  const emails = new Map((users.data?.users ?? []).map((u) => [u.id, u.email ?? null]));
  const totals = summarize((subs ?? []) as Parameters<typeof summarize>[0], (ledger ?? []) as Parameters<typeof summarize>[1]);
  const rows: Contributor[] = (people ?? []).map((p) => {
    const t = totals.get(p.id);
    return {
      id: p.id,
      handle: p.handle,
      email: emails.get(p.id) ?? null,
      tiktok: p.tiktok_handle,
      phone: p.phone,
      tier: p.tier as Tier,
      active: !p.banned,
      joined: p.created_at,
      points: t?.points ?? 0,
      scans: t?.scans ?? 0,
      videos: t?.videos ?? 0,
      pending: t?.pending ?? 0,
      lastSubmitted: t?.lastSubmitted ?? null,
    };
  });
  const active = rows.filter((r) => r.active).length;
  return (
    <AppShell>
      <div className="space-y-5">
        <LargeTitle title="Contributors" subtitle={`${active} active · ${rows.length - active} inactive`} />
        <ReviewTabs active="contributors" />
        <ContributorManager initial={rows} />
      </div>
    </AppShell>
  );
}
