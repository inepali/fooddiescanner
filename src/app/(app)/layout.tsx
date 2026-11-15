import type { Metadata } from "next";

// The private scanner tool (password protected by middleware when APP_PASSWORD is set).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-2xl p-4 pb-28 sm:p-6 md:pb-6 has-[[data-wide]]:max-w-5xl">{children}</main>;
}
