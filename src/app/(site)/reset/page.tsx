import type { Metadata } from "next";
import { ResetForm } from "@/components/site/PasswordReset";

export const metadata: Metadata = { title: "Set a new password", robots: { index: false } };

type Props = { searchParams: Promise<{ to?: string }> };

/** Where the reset email lands. The one-time code arrives in the URL #fragment, which only the browser sees. */
export default async function ResetPage({ searchParams }: Props) {
  const admin = (await searchParams).to === "login";
  return (
    <main className="mx-auto max-w-md px-5 pb-20 pt-6 sm:px-8">
      <div className="space-y-6 rounded-3xl bg-white p-7 shadow-sm">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Set a new password</h1>
        <ResetForm admin={admin} />
      </div>
    </main>
  );
}
