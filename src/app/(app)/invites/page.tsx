import AppShell from "@/components/AppShell";
import InviteManager, { type Invite } from "@/components/InviteManager";
import LargeTitle from "@/components/LargeTitle";
import ReviewTabs from "@/components/ReviewTabs";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Make invite codes for the points program and see who used them. */
export default async function InvitesPage() {
  const db = supabase();
  const [{ data, error }, { count: members }] = await Promise.all([
    db.from("invites").select("code, tier, uses, max_uses, expires_at, created_at").order("created_at", { ascending: false }).limit(200),
    db.from("creators").select("id", { count: "exact", head: true }),
  ]);
  if (error) throw new Error(`Could not load invites: ${error.message}`);
  return (
    <AppShell>
      <div className="space-y-5">
        <LargeTitle title="Invites" subtitle={`${members ?? 0} ${members === 1 ? "member" : "members"} so far`} />
        <ReviewTabs active="invites" />
        <InviteManager initial={(data ?? []) as Invite[]} />
      </div>
    </AppShell>
  );
}
