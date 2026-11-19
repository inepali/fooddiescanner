import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "@/components/site/PasswordReset";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };

type Props = { searchParams: Promise<{ to?: string }> };

export default async function ForgotPage({ searchParams }: Props) {
  const admin = (await searchParams).to === "login";
  return (
    <main className="mx-auto max-w-md px-5 pb-20 pt-6 sm:px-8">
      <div className="space-y-6 rounded-3xl bg-white p-7 shadow-sm">
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Forgot your password?</h1>
          <p className="text-[15px] text-[#3D4C42]">Enter your email and we’ll send you a link to set a new one.</p>
        </div>
        <ForgotForm admin={admin} />
        <p className="text-center text-sm">
          Remembered it? <Link href={admin ? "/admin" : "/signin"} className="font-semibold text-[#1E6B45]">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
