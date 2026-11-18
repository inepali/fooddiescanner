import type { Metadata } from "next";
import LoginForm from "@/components/LoginForm";
import { adminEmails, safeNext } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };

type Props = { searchParams: Promise<{ next?: string | string[] }> };

export default async function LoginPage({ searchParams }: Props) {
  const raw = (await searchParams).next;
  const next = safeNext(Array.isArray(raw) ? raw[0] : raw);
  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="w-full max-w-sm space-y-6 rounded-3xl bg-white p-7 shadow-sm">
        <div className="space-y-2 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1E6B45]">
            <svg aria-hidden width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F2B705" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10" />
            </svg>
          </span>
          <h1 className="text-2xl font-bold tracking-tight">Fooddie Scanner</h1>
          <p className="text-[15px] text-neutral-500">Sign in to scan labels and make videos.</p>
        </div>
        <LoginForm next={next} withEmail={adminEmails().length > 0} />
        {adminEmails().length > 0 && (
          <p className="text-right text-sm">
            <a href="/forgot?to=login" className="font-medium text-accent">Forgot password?</a>
          </p>
        )}
        <p className="text-center text-sm">
          <a href="/" className="text-accent">
            ← Back to the public library
          </a>
        </p>
      </div>
    </div>
  );
}
