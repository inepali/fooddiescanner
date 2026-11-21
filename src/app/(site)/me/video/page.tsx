import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import MemberScan from "@/components/site/MemberScan";
import { wantedProducts } from "@/lib/wanted";
import { memberFromToken } from "@/lib/member-auth";
import { canSubmit } from "@/lib/member-scan";
import { MEMBER_ACCESS_COOKIE, MEMBER_REFRESH_COOKIE } from "@/lib/members";

export const metadata: Metadata = { title: "Send a video", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Video contributors (creator tier): product photo + their own 60 s video, reviewed by the admin. */
export default async function MemberVideoPage() {
  const jar = await cookies();
  const member = await memberFromToken(jar.get(MEMBER_ACCESS_COOKIE)?.value);
  if (!member) redirect(jar.get(MEMBER_REFRESH_COOKIE)?.value ? "/api/members/refresh?next=/me/video" : "/signin?next=/me/video");
  if (!canSubmit("video", member.tier)) redirect("/me");
  return (
    <main className="mx-auto max-w-md px-5 pb-20 pt-6 sm:px-8">
      <MemberScan kind="video" wanted={await wantedProducts()} />
    </main>
  );
}
