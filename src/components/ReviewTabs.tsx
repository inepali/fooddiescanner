import Link from "next/link";

type Tab = "pending" | "done" | "invites" | "contributors";
const TABS: { id: Tab; label: string; href: string }[] = [
  { id: "pending", label: "Waiting", href: "/review" },
  { id: "done", label: "Reviewed", href: "/review?show=done" },
  { id: "invites", label: "Invites", href: "/invites" },
  { id: "contributors", label: "Contributors", href: "/contributors" },
];

/** Tabs shared by the Review, Invites and Contributors screens. */
export default function ReviewTabs({ active }: { active: Tab }) {
  return (
    <div className="flex gap-2 overflow-x-auto">
      {TABS.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          aria-current={active === t.id ? "page" : undefined}
          className={`rounded-full px-4 py-2 text-sm font-medium ${active === t.id ? "bg-accent text-white" : "bg-white text-neutral-600"}`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
