import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/site/MemberForms";
import { memberFromToken } from "@/lib/member-auth";
import { MEMBER_ACCESS_COOKIE, memberNext } from "@/lib/members";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

type Props = { searchParams: Promise<{ next?: string | string[]; confirmed?: string }> };

export default async function SignInPage({ searchParams }: Props) {
  const sp = await searchParams;
  const next = memberNext(Array.isArray(sp.next) ? sp.next[0] : sp.next);
  // Already signed in (e.g. tapped "Contributor login" in the header): go straight to their page.
  if (await memberFromToken((await cookies()).get(MEMBER_ACCESS_COOKIE)?.value)) redirect(next);
  return (
    <main className="mx-auto max-w-md px-5 pb-20 pt-6 sm:px-8">
      <div className="space-y-6 rounded-3xl bg-white p-7 shadow-sm">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Sign in</h1>
        {sp.confirmed && (
          <p role="status" className="rounded-xl bg-[#E8F2EC] p-3 text-[15px]">
            Email confirmed. Sign in to continue.
          </p>
        )}
        <SignInForm next={next} />
        <p className="text-center text-sm">
          New here? <Link href="/join" className="font-semibold text-[#1E6B45]">Join</Link>
        </p>
      </div>
    </main>
  );
}
