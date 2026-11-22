import type { Metadata } from "next";
import Link from "next/link";
import { JoinForm } from "@/components/site/MemberForms";
import { normalizeInviteCode } from "@/lib/members";

export const metadata: Metadata = { title: "Join and earn points", robots: { index: false } };

type Props = { searchParams: Promise<{ code?: string | string[] }> };

export default async function JoinPage({ searchParams }: Props) {
  const raw = (await searchParams).code;
  const code = normalizeInviteCode(Array.isArray(raw) ? raw[0] : raw) ?? "";
  const inviteOnly = process.env.OPEN_SIGNUP !== "true";
  return (
    <main className="mx-auto max-w-md px-5 pb-20 pt-6 sm:px-8">
      <div className="space-y-6 rounded-3xl bg-white p-7 shadow-sm">
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Scan your pantry, earn points</h1>
          <p className="text-[15px] text-[#3D4C42]">
            Every product you scan joins the public library. You get 10 points per scan, 20 for a real product photo, and 20 more when you’re the first to scan a product. Invited video creators earn 1,000 points for each accepted video (at least 45 seconds). The top ten make the public leaderboard.
          </p>
        </div>
        <JoinForm code={code} inviteOnly={inviteOnly} />
        <p className="text-center text-[13px] text-[#5B6B60]">
          By joining you confirm you’re 18 or older and live in the US, and you agree to the{" "}
          <Link href="/terms" className="underline">Terms</Link> (including the points rules) and{" "}
          <Link href="/privacy" className="underline">Privacy Policy</Link>. Points have no monetary value and are never paid out or redeemed.
        </p>
        <p className="text-center text-sm">
          Already joined? <Link href="/signin" className="font-semibold text-[#1E6B45]">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
