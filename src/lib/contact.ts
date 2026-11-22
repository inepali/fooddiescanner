// Homepage contact form: validation and the email it sends to support.
// Sent with Resend's HTTP API (no SDK). Set RESEND_API_KEY and verify the sending domain in Resend.

import { normalizeEmail } from "./members.ts";

export const CONTACT_LIMITS = { name: 100, message: 5000, minMessage: 10 } as const;

export type ContactInput = { name: string; email: string; message: string };

/** Checks the form body. Returns the cleaned fields, or the first problem to show the user. */
export function parseContact(body: Record<string, unknown>): { ok: true; value: ContactInput } | { ok: false; error: string } {
  const name = typeof body.name === "string" ? body.name.replace(/\s+/g, " ").trim() : "";
  const email = normalizeEmail(body.email);
  const message = typeof body.message === "string" ? body.message.replace(/\r\n/g, "\n").trim() : "";

  if (!name) return { ok: false, error: "Enter your full name." };
  if (name.length > CONTACT_LIMITS.name) return { ok: false, error: `Keep your name under ${CONTACT_LIMITS.name} characters.` };
  if (!email) return { ok: false, error: "Enter a valid email so we can reply." };
  if (message.length < CONTACT_LIMITS.minMessage) return { ok: false, error: "Tell us a little more in your message." };
  if (message.length > CONTACT_LIMITS.message) return { ok: false, error: `Keep your message under ${CONTACT_LIMITS.message} characters.` };
  return { ok: true, value: { name, email, message } };
}

/** True when the hidden "company" field was filled in, which only bots do. */
export function isBot(body: Record<string, unknown>): boolean {
  return typeof body.company === "string" && body.company.trim() !== "";
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** The Resend payload: to support, Reply-To the sender, so replying in your inbox answers them. */
export function contactEmail(input: ContactInput, to: string, from: string) {
  // Header-safe subject: no line breaks from the name.
  const subject = `Contact form: ${input.name.replace(/[\r\n]+/g, " ")}`;
  const text = `From: ${input.name} <${input.email}>\n\n${input.message}\n`;
  const html =
    `<p><strong>From:</strong> ${escapeHtml(input.name)} &lt;${escapeHtml(input.email)}&gt;</p>` +
    `<p style="white-space:pre-wrap">${escapeHtml(input.message)}</p>`;
  return { from, to: [to], reply_to: input.email, subject, text, html };
}

export async function sendContactEmail(input: ContactInput, to: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set.");
  const from = process.env.CONTACT_FROM || "Fooddie Scanner <noreply@fooddiescanner.com>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(contactEmail(input, to, from)),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text().catch(() => "")}`);
}
