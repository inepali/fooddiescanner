import Link from "next/link";
import SearchBar from "@/components/site/SearchBar";
import ScanCard from "@/components/site/ScanCard";
import { supabase } from "@/lib/supabase";
import { BAND_LABEL, BAND_STYLE, libraryStats, mostFlagged, orEmpty, recentScans } from "@/lib/library";
import type { Band } from "@/lib/scoring";
import { CONTACT_EMAIL } from "@/components/LegalPage";
import { MAX_MEMBER_VIDEOS, POINTS, VIDEO_MAX_S, VIDEO_MIN_S } from "@/lib/member-scan";

// Rebuilt at most every 5 minutes, so a scan you make public shows up shortly after.
export const revalidate = 300;

const BANDS: { band: Band; range: string; text: string }[] = [
  { band: "great", range: "80–100", text: "Whole, minimally processed ingredients." },
  { band: "good", range: "60–79", text: "Mostly solid, a few things to note." },
  { band: "fair", range: "40–59", text: "A mix. Worth reading the details." },
  { band: "poor", range: "20–39", text: "More added sugar, refined oils or additives." },
  { band: "avoid", range: "0–19", text: "Mostly highly processed ingredients." },
];

const STEPS = [
  { title: "Scan the label", text: "The ingredient list and nutrition panel are photographed straight from the package, or looked up by barcode." },
  { title: "Score every ingredient", text: "Each ingredient gets a 0–100 score and a plain-English reason, in the order it appears on the label." },
  { title: "Cross-check", text: "When the product is on Open Food Facts, its Nutri-Score, NOVA and Green-Score are blended in." },
  { title: "Review", text: "A person checks the breakdown against the label photo before it is published." },
  { title: "Publish the breakdown", text: "The result goes into this library: searchable, shareable and free to read." },
];

const FAQ = [
  {
    q: "What is Fooddie Scanner?",
    a: "A public library of food label breakdowns. Real products are scanned, their ingredients scored, and every published result is kept here so anyone can search and read it.",
  },
  {
    q: "How is the score calculated?",
    a: "Each ingredient is scored 0–100. Ingredients near the top of the label weigh more, because labels list ingredients by weight. Any ingredient under 20 caps the product at 60, and partially hydrogenated oil caps it at 30. When the product is found on Open Food Facts, its grades make up 40% of the final score.",
  },
  {
    q: "Is this medical or dietary advice?",
    a: "No. Fooddie Scanner is for information and education only. Scores are our opinion under a general nutrition rubric, made with AI help, not a safety rating or a recommendation to buy or avoid anything. If you have an allergy, a health condition or specific dietary needs, check the actual package and talk to a doctor or registered dietitian.",
  },
  {
    q: "Are you connected to the brands you scan?",
    a: "No. Fooddie Scanner is independent and isn't affiliated with, sponsored by or endorsed by any brand or retailer. Brand names and package photos are shown only to identify the product being discussed.",
  },
  {
    q: "I found a mistake. How do I report it?",
    a: "Email us with the page link and, if you can, a photo of the current label. Brands and manufacturers are welcome to send corrections too. We review every request and update, rescan or remove the breakdown.",
  },
  {
    q: "The label I bought looks different. Why?",
    a: "Brands reformulate products and labels vary by region. Each breakdown is a snapshot of the package that was scanned.",
  },
  { q: "Is it free?", a: "Yes. Searching and reading every breakdown is free, with no account needed." },
  {
    q: "How do I become a contributor?",
    a: "Contributors join by invite for now and must be 18 or older and live in the US. If you have an invite code, sign up on the Join page. Otherwise, contact us and tell us a little about yourself and the stores you shop at.",
  },
  {
    q: "When do I get my rewards?",
    a: "Points are added when the team reviews and accepts your submission. Points have no cash value until redeemed under the rules in your account. Before rewards can be paid, confirm your email and add your phone number and TikTok handle on your account page. See the Terms for the full program rules.",
  },
];

const fmt = (n: number) => n.toLocaleString("en-US");

const ROLES = [
  {
    title: "Scanners",
    who: "Anyone with a pantry or a grocery cart.",
    steps: ["Photograph the ingredient label", "Add a clear photo of the product", "We score it and publish the breakdown"],
    earn: [
      [`${POINTS.scan}`, "points per accepted scan"],
      [`+${POINTS.photo}`, "for a real product photo"],
      [`+${POINTS.first_scan}`, "when you're first to scan a product"],
    ],
  },
  {
    title: "Video creators",
    who: "Invited creators who like being on camera.",
    steps: [
      `Film about a minute on the product (${VIDEO_MIN_S}–${VIDEO_MAX_S} s)`,
      `Upload or record in the app, up to ${MAX_MEMBER_VIDEOS} clips`,
      "We add the voiceover and score, then post it",
    ],
    earn: [
      [fmt(POINTS.video), "points per accepted video"],
      [`+${POINTS.photo}`, "for the product photo"],
    ],
  },
] as const;

const PERKS = [
  ["Earn rewards", "Accepted scans and videos earn points toward rewards, under the program rules in our Terms."],
  ["Get featured", "Accepted videos are posted to Fooddie Scanner's TikTok, Instagram and YouTube."],
  ["Help other shoppers", "Your scan becomes a free, searchable breakdown anyone can read."],
  ["Know your pantry", "See exactly what's in the food you already buy, ingredient by ingredient."],
];

const CONTACT = [
  { label: "Email", value: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` },
  { label: "Phone", value: "+1 (704) 750-5858", href: "tel:+17047505858" },
  { label: "Based in", value: "Charlotte, NC" },
  { label: "Hours", value: "Monday – Friday, 7:00 AM – 7:00 PM ET" },
];

const SOCIAL = [
  { label: "TikTok", url: process.env.NEXT_PUBLIC_TIKTOK_URL },
  { label: "Instagram", url: process.env.NEXT_PUBLIC_INSTAGRAM_URL },
  { label: "YouTube", url: process.env.NEXT_PUBLIC_YOUTUBE_URL },
].filter((s): s is { label: string; url: string } => !!s.url);

const eyebrow = "text-sm font-bold uppercase tracking-[0.08em] text-[#1E6B45]";
const h2 = "font-display text-4xl font-extrabold tracking-tight sm:text-[44px] sm:leading-[1.08]";
const wrap = "mx-auto max-w-6xl px-5 sm:px-8";

export default async function Home() {
  const [recent, flagged, stats] = await Promise.all([
    orEmpty(() => recentScans(supabase(), 6), []),
    orEmpty(() => mostFlagged(supabase(), 6), []),
    orEmpty(() => libraryStats(supabase()), { products: 0, ingredients: 0 }),
  ]);
  const chips = flagged.slice(0, 5).map((f) => f.name);

  return (
    <>
      {/* HERO */}
      <section className={`${wrap} flex flex-col items-center gap-7 pb-20 pt-14 text-center sm:pt-20`}>
        <span className="inline-flex items-center gap-2 rounded-full bg-[#E4EFE6] px-3.5 py-2 text-sm font-semibold text-[#134A2F]">
          <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          A free, open library of food label breakdowns
        </span>
        <h1 className="font-display max-w-4xl text-5xl font-extrabold leading-none tracking-[-0.035em] sm:text-7xl">
          Know what’s <span className="rounded-2xl bg-[#F2B705] px-3">really</span> in your food.
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-[#3C4A42] sm:text-xl">
          Every label we scan is scored ingredient by ingredient and saved here. Search any product, brand or ingredient and read the full
          breakdown in plain English.
        </p>
        <div className="mt-2 flex w-full justify-center">
          <SearchBar />
        </div>
        {chips.length > 0 && (
          <div className="flex max-w-3xl flex-wrap items-center justify-center gap-2.5">
            <span className="text-sm font-semibold text-[#3C4A42]">Most flagged:</span>
            {chips.map((c) => (
              <Link
                key={c}
                href={`/search?q=${encodeURIComponent(c)}`}
                className="flex min-h-11 items-center rounded-full border-[1.5px] border-[#C9D3CB] bg-[#EEF1EA] px-4 text-[15px] font-medium text-[#14201A] hover:border-[#14201A] hover:bg-white"
              >
                {c}
              </Link>
            ))}
          </div>
        )}
        <dl className="mt-3 flex flex-wrap justify-center gap-10 text-[15px] text-[#3C4A42]">
          <div className="flex flex-col-reverse">
            <dt>products scanned</dt>
            <dd className="font-display text-3xl font-extrabold text-[#14201A]">{stats.products}</dd>
          </div>
          <div className="flex flex-col-reverse">
            <dt>ingredients scored</dt>
            <dd className="font-display text-3xl font-extrabold text-[#14201A]">{stats.ingredients}</dd>
          </div>
          <div className="flex flex-col-reverse">
            <dt>free to read</dt>
            <dd className="font-display text-3xl font-extrabold text-[#14201A]">100%</dd>
          </div>
        </dl>
      </section>

      {/* RECENT */}
      <section id="recent" className="scroll-mt-6 border-y border-[#E2E6DE] bg-white">
        <div className={`${wrap} flex flex-col gap-8 py-20`}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-2">
              <h2 className={h2}>Recently scanned</h2>
              <p className="text-[17px] text-[#3C4A42]">The latest labels added to the library.</p>
            </div>
            <Link href="/search" className="text-base font-semibold">
              View all scans →
            </Link>
          </div>
          {recent.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {recent.map((s) => (
                <ScanCard key={s.id} scan={s} />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl bg-[#F6F7F2] p-8 text-[#3C4A42]">The first breakdowns are on their way. Check back soon.</p>
          )}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className={`${wrap} flex flex-col gap-12 py-24`}>
        <div className="max-w-3xl space-y-3">
          <p className={eyebrow}>How it works</p>
          <h2 className={h2}>From the grocery shelf to a breakdown anyone can read.</h2>
        </div>
        <ol className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex flex-col gap-3.5 rounded-[20px] border border-[#E2E6DE] bg-white p-7">
              <span className="font-display text-4xl font-extrabold text-[#1E6B45]" aria-hidden>
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="text-xl font-bold">{s.title}</h3>
              <p className="text-base leading-relaxed text-[#3C4A42]">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* SCORING */}
      <section id="scoring" className="scroll-mt-6 bg-[#14201A] text-[#F6F7F2]">
        <div className={`${wrap} flex flex-col gap-10 py-24`}>
          <div className="max-w-2xl space-y-3">
            <p className="text-sm font-bold uppercase tracking-[0.08em] text-[#F2B705]">The Fooddie Score</p>
            <h2 className={h2}>One number, with the reasoning shown.</h2>
            <p className="text-[17px] leading-relaxed text-[#C9D3CB]">
              Every product gets a score from 0 to 100 under our rubric. Open any breakdown to see which ingredients moved it up or down, and why. The score reflects the ingredient list only, not whether a product is safe or right for you.
            </p>
          </div>
          <ul className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
            {BANDS.map((b) => (
              <li key={b.band} className="flex flex-col gap-1.5 rounded-[18px] p-5" style={{ background: BAND_STYLE[b.band].bg, color: BAND_STYLE[b.band].fg }}>
                <span className="font-display text-3xl font-extrabold">{b.range}</span>
                <span className="text-lg font-bold">{BAND_LABEL[b.band]}</span>
                <span className="text-sm leading-snug">{b.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* MOST FLAGGED INGREDIENTS */}
      {flagged.length > 0 && (
        <section id="ingredients" className={`${wrap} scroll-mt-6 py-24`}>
          <div className="flex flex-wrap gap-12 rounded-[28px] bg-[#E4EFE6] p-8 sm:p-14">
            <div className="flex-[1_1_320px] space-y-4">
              <p className="text-sm font-bold uppercase tracking-[0.08em] text-[#134A2F]">Ingredient watch</p>
              <h2 className="font-display text-4xl font-extrabold leading-tight tracking-tight">The ingredients we flag most.</h2>
              <p className="text-[17px] leading-relaxed text-[#2F3D35]">
                These ingredients score low under our rubric and show up in the most products in the library. Tap one to see every product that contains it.
              </p>
            </div>
            <ul className="flex flex-[1_1_420px] flex-col gap-3">
              {flagged.map((f) => (
                <li key={f.name}>
                  <Link
                    href={`/search?q=${encodeURIComponent(f.name)}`}
                    className="flex items-center justify-between gap-4 rounded-2xl bg-white px-5 py-4 text-[#14201A] hover:shadow-[0_8px_20px_rgba(20,32,26,0.08)]"
                  >
                    <span className="min-w-0 space-y-1">
                      <span className="block text-[17px] font-bold">{f.name}</span>
                      <span className="line-clamp-2 block text-sm text-[#3C4A42]">
                        In {f.products} {f.products === 1 ? "product" : "products"}
                        {f.reason ? ` · ${f.reason}` : ""}
                      </span>
                    </span>
                    <span
                      className="shrink-0 rounded-lg px-2.5 py-1.5 text-[13px] font-bold"
                      style={{ background: BAND_STYLE[f.band].bg, color: BAND_STYLE[f.band].fg }}
                    >
                      {f.score} · {BAND_LABEL[f.band]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* METHODOLOGY */}
      <section id="methodology" className="scroll-mt-6 border-y border-[#E2E6DE] bg-white">
        <div className={`${wrap} flex flex-col gap-10 py-24`}>
          <div className="max-w-3xl space-y-3">
            <p className={eyebrow}>Why trust it</p>
            <h2 className={h2}>Transparent by design.</h2>
          </div>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Every reason shown", "Each ingredient’s score comes with a short explanation, so you can judge the reasoning yourself."],
              ["Label order matters", "Ingredients are weighted by their position on the label, the way manufacturers list them by weight."],
              ["Outside data", "Where available, Open Food Facts grades (Nutri-Score, NOVA, Green-Score) are blended in and shown."],
              ["Honest limits", "Scores are our opinion, made with AI help under a general nutrition rubric and reviewed by a person. They’re a starting point, not medical advice or a safety rating."],
            ].map(([title, text]) => (
              <div key={title} className="space-y-2.5 border-t-[3px] border-[#14201A] pt-5">
                <h3 className="text-xl font-bold">{title}</h3>
                <p className="text-base leading-relaxed text-[#3C4A42]">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTRIBUTE */}
      <section id="contribute" className={`${wrap} scroll-mt-6 flex flex-col gap-12 py-24`}>
        <div className="max-w-3xl space-y-3">
          <p className={eyebrow}>Become a contributor</p>
          <h2 className={h2}>Scan your pantry. Join and earn rewards.</h2>
          <p className="text-[17px] leading-relaxed text-[#3C4A42]">
            The library grows because real shoppers scan the food they actually buy. Contributors send in labels and short videos, our team
            reviews every submission, and accepted ones go live for everyone to read and watch.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {ROLES.map((r) => (
            <div key={r.title} className="flex flex-col gap-6 rounded-[24px] border border-[#E2E6DE] bg-white p-8">
              <div className="space-y-1.5">
                <h3 className="font-display text-3xl font-extrabold tracking-tight">{r.title}</h3>
                <p className="text-base text-[#3C4A42]">{r.who}</p>
              </div>
              <ol className="space-y-2.5">
                {r.steps.map((s, i) => (
                  <li key={s} className="flex gap-3 text-base">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E4EFE6] text-sm font-bold text-[#134A2F]">{i + 1}</span>
                    <span className="pt-0.5">{s}</span>
                  </li>
                ))}
              </ol>
              <dl className="mt-auto flex flex-wrap gap-x-8 gap-y-4 rounded-2xl bg-[#F6F7F2] p-5">
                {r.earn.map(([n, t]) => (
                  <div key={t} className="flex flex-col-reverse">
                    <dt className="text-sm text-[#3C4A42]">{t}</dt>
                    <dd className="font-display text-2xl font-extrabold text-[#1E6B45]">{n}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {PERKS.map(([title, text]) => (
            <div key={title} className="space-y-2.5 border-t-[3px] border-[#1E6B45] pt-5">
              <h3 className="text-xl font-bold">{title}</h3>
              <p className="text-base leading-relaxed text-[#3C4A42]">{text}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-6 rounded-[24px] bg-[#F2B705] p-8 sm:p-10">
          <div className="max-w-xl space-y-1.5">
            <p className="font-display text-2xl font-extrabold text-[#14201A]">Joining is by invite for now.</p>
            <p className="text-base text-[#14201A]">
              Got a code? Sign up in a minute. No code yet? Get in touch and we’ll add you to the list. One submission per day keeps quality high.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/join" className="flex min-h-12 items-center rounded-full bg-[#14201A] px-6 font-bold text-white hover:bg-[#2F3D35]">
              Join with a code
            </Link>
            <Link href="/#contact" className="flex min-h-12 items-center rounded-full border-2 border-[#14201A] px-6 font-bold text-[#14201A] hover:bg-white/40">
              Request an invite
            </Link>
          </div>
        </div>
      </section>

      {/* FOLLOW */}
      {SOCIAL.length > 0 && (
        <section className={`${wrap} py-24`}>
          <div className="flex flex-wrap items-center justify-between gap-8 rounded-[28px] bg-[#1E6B45] p-8 text-white sm:p-14">
            <div className="max-w-xl space-y-3">
              <h2 className="font-display text-4xl font-extrabold leading-tight tracking-tight">60 seconds per label.</h2>
              <p className="text-[17px] leading-relaxed text-[#E4EFE6]">Short, no-nonsense video breakdowns of every scan. Follow along:</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {SOCIAL.map((s) => (
                <a key={s.label} href={s.url} target="_blank" rel="noreferrer" className="flex min-h-12 items-center rounded-full bg-[#F2B705] px-6 font-bold text-[#14201A] hover:bg-[#FFC928]">
                  {s.label}
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section id="faq" className="scroll-mt-6 mx-auto max-w-3xl px-5 py-24 sm:px-8">
        <h2 className={`${h2} mb-8 text-center`}>Questions</h2>
        <div>
          {FAQ.map((f) => (
            <details key={f.q} className="group border-b border-[#E2E6DE] py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-bold [&::-webkit-details-marker]:hidden">
                {f.q}
                <span aria-hidden className="text-2xl text-[#1E6B45] transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-base leading-relaxed text-[#3C4A42]">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className={`${wrap} scroll-mt-6 pb-24`}>
        <div className="grid grid-cols-1 gap-10 rounded-[28px] bg-[#14201A] p-8 text-[#F6F7F2] sm:p-14 lg:grid-cols-[1fr_1.2fr]">
          <div className="space-y-3">
            <p className="text-sm font-bold uppercase tracking-[0.08em] text-[#F2B705]">Contact</p>
            <h2 className="font-display text-4xl font-extrabold leading-tight tracking-tight">Get in touch.</h2>
            <p className="text-[17px] leading-relaxed text-[#C9D3CB]">
              Questions about a breakdown, a correction for a label (brands welcome), an invite request or a partnership idea? We’d love to hear from you.
            </p>
          </div>
          <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {CONTACT.map((c) => (
              <div key={c.label} className="space-y-1">
                <dt className="text-xs font-bold uppercase tracking-wider text-[#A9B5AD]">{c.label}</dt>
                <dd className="break-words text-lg font-semibold text-white">
                  {c.href ? (
                    <a href={c.href} className="text-white hover:text-[#F2B705]">
                      {c.value}
                    </a>
                  ) : (
                    c.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
}
