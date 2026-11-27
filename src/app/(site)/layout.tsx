import { Bricolage_Grotesque, Inter } from "next/font/google";
import Link from "next/link";
import MemberButton from "@/components/site/MemberButton";

const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-display" });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

/** The public library's frame: header, footer and its own look (separate from the scanner tool). */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`site ${display.variable} ${body.variable} min-h-screen bg-[#F6F7F2] text-[#14201A]`}>
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">
        Skip to content
      </a>
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 text-[#14201A] no-underline">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1E6B45]">
            <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F2B705" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10" />
            </svg>
          </span>
          <span className="font-display text-[22px] font-extrabold tracking-tight">Fooddie Scanner</span>
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-7 text-[15px] font-medium md:flex">
          <Link href="/#recent" className="text-[#14201A] hover:text-[#1E6B45]">Browse scans</Link>
          <Link href="/scoring-rubric" className="text-[#14201A] hover:text-[#1E6B45]">Scoring rubric</Link>
          <Link href="/#ingredients" className="text-[#14201A] hover:text-[#1E6B45]">Ingredients</Link>
          <Link href="/#contribute" className="text-[#14201A] hover:text-[#1E6B45]">Contribute</Link>
          <Link href="/#faq" className="text-[#14201A] hover:text-[#1E6B45]">FAQ</Link>
          <Link href="/#contact" className="text-[#14201A] hover:text-[#1E6B45]">Contact</Link>
        </nav>
        <MemberButton />
      </header>

      <div id="content">{children}</div>

      <footer className="bg-[#14201A] text-[#C9D3CB]">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-5 pb-10 pt-16 sm:px-8">
          <div className="flex flex-wrap justify-between gap-10">
            <div className="max-w-sm space-y-3">
              <p className="font-display text-2xl font-extrabold text-white">Fooddie Scanner</p>
              <p className="text-[15px] leading-relaxed">An open library of food label breakdowns. Search it, share it, and know what you’re eating.</p>
            </div>
            <nav aria-label="Library" className="flex flex-col gap-2.5 text-[15px]">
              <span className="font-bold text-white">Library</span>
              <Link href="/search" className="text-[#C9D3CB] hover:text-white">Search all scans</Link>
              <Link href="/#ingredients" className="text-[#C9D3CB] hover:text-white">Most-flagged ingredients</Link>
              <Link href="/scoring-rubric" className="text-[#C9D3CB] hover:text-white">Scoring rubric</Link>
            </nav>
            <nav aria-label="About" className="flex flex-col gap-2.5 text-[15px]">
              <span className="font-bold text-white">About</span>
              <Link href="/#methodology" className="text-[#C9D3CB] hover:text-white">Methodology</Link>
              <Link href="/#contribute" className="text-[#C9D3CB] hover:text-white">Become a contributor</Link>
              <Link href="/#contact" className="text-[#C9D3CB] hover:text-white">Contact</Link>
              <Link href="/privacy" className="text-[#C9D3CB] hover:text-white">Privacy</Link>
              <Link href="/terms" className="text-[#C9D3CB] hover:text-white">Terms</Link>
            </nav>
          </div>
          <div className="flex flex-wrap justify-between gap-4 border-t border-[#2F3D35] pt-6 text-[13px] text-[#A9B5AD]">
            <span>© {new Date().getFullYear()} Fooddie Scanner · fooddiescanner.com</span>
            <span className="max-w-xl">For information and education only. Scores are our opinion, not medical or dietary advice. Not affiliated with any brand shown.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
