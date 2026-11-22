import { NextResponse } from "next/server";
import { CONTACT_EMAIL } from "@/components/LegalPage";
import { isBot, parseContact, sendContactEmail } from "@/lib/contact";

// POST { name, email, message, company } → emails the homepage contact form to support.
// Public (see middleware). "company" is a hidden honeypot: bots fill it, people don't.

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  // Pretend it worked so bots don't learn anything.
  if (isBot(body)) return NextResponse.json({ ok: true });

  const parsed = parseContact(body);
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });

  try {
    await sendContactEmail(parsed.value, process.env.CONTACT_TO || CONTACT_EMAIL);
  } catch (err) {
    console.error("contact form:", err);
    return NextResponse.json({ ok: false, error: "Couldn’t send your message right now. Please try again in a few minutes." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
