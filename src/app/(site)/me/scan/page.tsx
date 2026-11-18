import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import MemberScan from "@/components/site/MemberScan";
import { MEMBER_ACCESS_COOKIE, MEMBER_REFRESH_COOKIE } from "@/lib/members";

export const metadata: Metadata = { title: "Scan a product", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function MemberScanPage() {
  const jar = await cookies();
  // Cheap gate; the API checks the session properly on every call.
  if (!jar.get(MEMBER_ACCESS_COOKIE)?.value && !jar.get(MEMBER_REFRESH_COOKIE)?.value) redirect("/signin?next=/me/scan");
  return (
    <main className="mx-auto max-w-md px-5 pb-20 pt-6 sm:px-8">
      <MemberScan />
    </main>
  );
}
