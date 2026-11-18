import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { RewardDetailsForm } from "@/components/site/MemberForms";
import { memberFromToken } from "@/lib/member-auth";
import { MEMBER_ACCESS_COOKIE, MEMBER_REFRESH_COOKIE, rewardsMissing } from "@/lib/members";
import { supabase } from "@/lib/supabase";

export const metadata: Metadata = { title: "Your rewards", robots: { index: false } };
export const dynamic = "force-dynamic";

const LABELS = { email: "Confirm your email", phone: "Add your phone number", tiktok: "Add your TikTok username" } as const;

export default async function MePage() {
  const jar = await cookies();
  const member = await memberFromToken(jar.get(MEMBER_ACCESS_COOKIE)?.value);
  if (!member) {
    // Pages can't set cookies: renew the session in a route handler, or sign in again.
    redirect(jar.get(MEMBER_REFRESH_COOKIE)?.value ? "/api/members/refresh?next=/me" : "/signin?next=/me");
  }

  const { data: board } = await supabase()
    .from("leaderboard")
    .select("points, scans, first_scans")
    .eq("creator_id", member.id)
    .maybeSingle();
  const missing = rewardsMissing(member);
  const { data: recent } = await supabase()
    .from("scans")
    .select("id, product_name, overall_score, status, review_status")
    .eq("creator_id", member.id)
    .not("submitted_at", "is", null)
    .order("submitted_at", { ascending: false })
    .limit(10);

  return (
    <main className="mx-auto max-w-md space-y-6 px-5 pb-20 pt-6 sm:px-8">
      <section className="space-y-4 rounded-3xl bg-white p-7 shadow-sm">
        <div>
          <p className="text-sm text-[#5B6B60]">@{member.handle}{member.tier === "creator" ? " · Video creator" : ""}</p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">{board?.points ?? 0} points</h1>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-2xl bg-[#F6F7F2] p-4">
            <dt className="text-[13px] text-[#5B6B60]">Scans</dt>
            <dd className="text-2xl font-bold">{board?.scans ?? 0}</dd>
          </div>
          <div className="rounded-2xl bg-[#F6F7F2] p-4">
            <dt className="text-[13px] text-[#5B6B60]">First to scan</dt>
            <dd className="text-2xl font-bold">{board?.first_scans ?? 0}</dd>
          </div>
        </dl>
        <a href="/me/scan" className="flex h-12 w-full items-center justify-center rounded-xl bg-[#1E6B45] text-base font-semibold text-white">
          Scan a product
        </a>
      </section>

      {recent && recent.length > 0 && (
        <section className="space-y-3 rounded-3xl bg-white p-7 shadow-sm">
          <h2 className="text-xl font-bold">Your scans</h2>
          <ul className="divide-y divide-[#E6EAE4]">
            {recent.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0 truncate font-medium">{s.product_name ?? "Unnamed product"}</span>
                <span className="shrink-0 text-sm text-[#5B6B60]">
                  {s.status === "analyzed" ? `${s.overall_score}/100` : "Reading…"}
                  {s.review_status === "approved" ? " · Approved" : s.review_status === "rejected" ? " · Not approved" : " · In review"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-4 rounded-3xl bg-white p-7 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Rewards details</h2>
          {missing.length === 0 ? (
            <p className="text-[15px] text-[#1E6B45]">You’re all set for rewards.</p>
          ) : (
            <>
              <p className="text-[15px] text-[#3D4C42]">We need these before we can send you rewards:</p>
              <ul className="list-disc pl-5 text-[15px]">
                {missing.map((m) => (
                  <li key={m}>{LABELS[m]}{m === "email" ? ` (link sent to ${member.email})` : ""}</li>
                ))}
              </ul>
            </>
          )}
        </div>
        <RewardDetailsForm phone={member.phone} tiktok={member.tiktok} />
      </section>

      <form action="/api/members/logout" method="post">
        <button type="submit" className="min-h-11 w-full text-sm font-semibold text-[#5B6B60]">
          Sign out
        </button>
      </form>
    </main>
  );
}
