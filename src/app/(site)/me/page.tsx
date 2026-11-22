import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Leaderboard from "@/components/site/Leaderboard";
import { RewardDetailsForm } from "@/components/site/MemberForms";
import { topLeaders } from "@/lib/leaderboard";
import { memberFromToken } from "@/lib/member-auth";
import { canSubmit } from "@/lib/member-scan";
import { MEMBER_ACCESS_COOKIE, MEMBER_REFRESH_COOKIE } from "@/lib/members";
import { supabase } from "@/lib/supabase";
import { wantedProducts } from "@/lib/wanted";

export const metadata: Metadata = { title: "Your points", robots: { index: false } };
export const dynamic = "force-dynamic";

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
  const [{ data: recent }, { data: notices }] = await Promise.all([
    supabase()
      .from("scans")
      .select("id, product_name, overall_score, status, review_status, submission_kind")
      .eq("creator_id", member.id)
      .not("submitted_at", "is", null)
      .order("submitted_at", { ascending: false })
      .limit(10),
    supabase()
      .from("member_notifications")
      .select("id, message, created_at")
      .eq("creator_id", member.id)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  const videos = canSubmit("video", member.tier);
  const [wanted, leaders] = await Promise.all([wantedProducts(), topLeaders(supabase()).catch(() => [])]);
  const myRank = leaders.find((l) => l.handle === member.handle)?.rank ?? null;

  return (
    <main className="mx-auto max-w-md space-y-6 px-5 pb-20 pt-6 sm:px-8">
      {notices && notices.length > 0 && (
        <section aria-live="polite" className="space-y-3 rounded-3xl border-2 border-[#1E6B45] bg-white p-6 shadow-sm">
          <ul className="space-y-2">
            {notices.map((n) => (
              <li key={n.id} className="text-[15px] font-semibold text-[#1E6B45]">
                {n.message}
                <span className="block text-[13px] font-normal text-[#5B6B60]">
                  {new Date(n.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </li>
            ))}
          </ul>
          <form action="/api/members/notifications" method="post">
            <button type="submit" className="min-h-11 text-sm font-semibold text-[#5B6B60]">
              Got it
            </button>
          </form>
        </section>
      )}

      <section className="space-y-4 rounded-3xl bg-white p-7 shadow-sm">
        <div>
          <p className="text-sm text-[#5B6B60]">@{member.handle}{member.tier === "creator" ? " · Video creator" : ""}</p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">{(board?.points ?? 0).toLocaleString("en-US")} points</h1>
          <p className="text-[13px] text-[#5B6B60]">
            {myRank ? `#${myRank} on the leaderboard · ` : ""}Points are for bragging rights only and have no cash value.
          </p>
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
        {videos && (
          <a href="/me/video" className="flex h-12 w-full items-center justify-center rounded-xl bg-[#F6F7F2] text-base font-semibold text-[#1E6B45]">
            Send a video
          </a>
        )}
      </section>

      {wanted.length > 0 && (
        <section className="space-y-3 rounded-3xl bg-white p-7 shadow-sm">
          <div>
            <h2 className="text-xl font-bold">Wanted next</h2>
            <p className="text-[15px] text-[#3D4C42]">Spot one of these at the store? Scan it{videos ? " or send a video" : ""}.</p>
          </div>
          <ul className="divide-y divide-[#E6EAE4]">
            {wanted.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0 font-medium">{w.product}</span>
                <span className="shrink-0 rounded-full bg-[#FFF4D6] px-2 py-0.5 text-[12px] font-bold text-[#7A5200]">{w.store}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3 rounded-3xl bg-white p-7 shadow-sm">
        <div>
          <h2 className="text-xl font-bold">Top ten</h2>
          <p className="text-[15px] text-[#3D4C42]">{myRank ? "You’re on the board. Keep scanning to hold your spot." : "Earn points with accepted scans to make the top ten."}</p>
        </div>
        <Leaderboard rows={leaders} me={member.handle} />
      </section>

      {recent && recent.length > 0 && (
        <section className="space-y-3 rounded-3xl bg-white p-7 shadow-sm">
          <h2 className="text-xl font-bold">{videos ? "Your scans and videos" : "Your scans"}</h2>
          <ul className="divide-y divide-[#E6EAE4]">
            {recent.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0 truncate font-medium">
                  {s.submission_kind === "video" ? "🎬 " : ""}
                  {s.product_name ?? "Unnamed product"}
                </span>
                <span className="shrink-0 text-sm text-[#5B6B60]">
                  {s.submission_kind === "video" ? "Video" : s.status === "analyzed" ? `${s.overall_score}/100` : "Reading…"}
                  {s.review_status === "approved" ? (
                    <strong className="text-[#1E6B45]"> · Accepted</strong>
                  ) : s.review_status === "rejected" ? (
                    " · Not accepted"
                  ) : (
                    " · Waiting for review"
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-4 rounded-3xl bg-white p-7 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Your details</h2>
          {!member.emailConfirmed && (
            <p className="text-[15px] text-[#3D4C42]">Confirm your email: we sent a link to {member.email}.</p>
          )}
          <p className="text-[15px] text-[#3D4C42]">Optional. Your TikTok lets us tag you when we post your video.</p>
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
