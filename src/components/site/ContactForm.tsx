"use client";

import { useState } from "react";
import { CONTACT_LIMITS } from "@/lib/contact";

// Homepage contact form (dark card). Posts to /api/contact, which emails support.

const field =
  "w-full rounded-xl border border-white/15 bg-white/5 px-4 text-base text-white placeholder:text-[#8C998F] focus:border-[#F2B705] focus:outline-none";
const label = "block text-xs font-bold uppercase tracking-wider text-[#A9B5AD]";

export default function ContactForm() {
  const [f, setF] = useState({ name: "", email: "", message: "", company: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setSent(true);
        setF({ name: "", email: "", message: "", company: "" });
      } else {
        setError(data.error ?? "Couldn’t send your message. Please try again.");
      }
    } catch {
      setError("Couldn’t reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div role="status" className="flex flex-col justify-center space-y-3">
        <p className="font-display text-2xl font-extrabold text-white">Thanks, message sent.</p>
        <p className="text-[17px] leading-relaxed text-[#C9D3CB]">We’ll reply to the email you gave us.</p>
        <button type="button" onClick={() => setSent(false)} className="self-start font-semibold text-[#F2B705] hover:underline">
          Send another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="contact-name" className={label}>Full name</label>
          <input id="contact-name" name="name" required maxLength={CONTACT_LIMITS.name} autoComplete="name" value={f.name} onChange={set("name")} className={`${field} h-12`} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="contact-email" className={label}>Email</label>
          <input id="contact-email" name="email" type="email" required autoComplete="email" value={f.email} onChange={set("email")} className={`${field} h-12`} />
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="contact-message" className={label}>Message</label>
        <textarea id="contact-message" name="message" required rows={5} maxLength={CONTACT_LIMITS.message} value={f.message} onChange={set("message")} className={`${field} resize-y py-3`} />
      </div>
      {/* Honeypot: hidden from people and screen readers. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="contact-company">Company</label>
        <input id="contact-company" name="company" tabIndex={-1} autoComplete="off" value={f.company} onChange={set("company")} />
      </div>
      {error && (
        <p role="alert" className="text-sm font-semibold text-[#FFB4A8]">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className="flex min-h-12 items-center justify-center rounded-full bg-[#F2B705] px-7 font-bold text-[#14201A] hover:bg-[#FFC81F] disabled:opacity-60">
        {busy ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
