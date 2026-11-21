"use client";

import { useState } from "react";

// Join, sign-in and rewards-details forms for members (the public site's look).

const input =
  "h-12 w-full rounded-xl border border-[#D8DED6] bg-white px-4 text-base text-[#14201A] focus:border-[#1E6B45] focus:outline-none";
const button =
  "flex h-12 w-full items-center justify-center rounded-xl bg-[#1E6B45] text-base font-semibold text-white disabled:opacity-50";

function Field(props: { id: string; label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const { id, label, hint, ...rest } = props;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      <input id={id} name={id} className={input} aria-describedby={hint ? `${id}-hint` : undefined} {...rest} />
      {hint && (
        <p id={`${id}-hint`} className="text-[13px] text-[#5B6B60]">
          {hint}
        </p>
      )}
    </div>
  );
}

async function post(url: string, body: unknown): Promise<Record<string, unknown> & { ok?: boolean; error?: string }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & { ok?: boolean; error?: string };
    return res.ok ? data : { ...data, ok: false };
  } catch {
    return { ok: false, error: "Couldn’t reach the server. Check your connection and try again." };
  }
}

function ErrorText({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="text-sm text-red-700">
      {error}
    </p>
  ) : null;
}

export function JoinForm({ code: initialCode, inviteOnly }: { code: string; inviteOnly: boolean }) {
  const [f, setF] = useState({ email: "", password: "", handle: "", code: initialCode });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const data = await post("/api/members/signup", f);
    if (!data.ok) {
      setError(data.error ?? "Couldn’t create your account.");
      setBusy(false);
      return;
    }
    if (data.confirm) {
      setSent(true);
      setBusy(false);
    } else window.location.assign("/me");
  }

  if (sent) {
    return (
      <div role="status" className="space-y-2 rounded-2xl bg-[#E8F2EC] p-5">
        <p className="font-semibold">Check your email</p>
        <p className="text-[15px]">We sent a link to {f.email}. Tap it to confirm, then sign in.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {inviteOnly && (
        <Field id="code" label="Invite code" value={f.code} onChange={set("code")} autoCapitalize="characters" autoComplete="off" required />
      )}
      <Field id="email" label="Email" type="email" value={f.email} onChange={set("email")} autoComplete="email" required />
      <Field
        id="password"
        label="Password"
        type="password"
        value={f.password}
        onChange={set("password")}
        autoComplete="new-password"
        hint="At least 8 characters."
        required
      />
      <Field
        id="handle"
        label="Username"
        value={f.handle}
        onChange={set("handle")}
        autoCapitalize="none"
        autoComplete="username"
        hint="Shown on the leaderboard and on products you scan first."
        required
      />
      <ErrorText error={error} />
      <button type="submit" disabled={busy} className={button}>
        {busy ? "Creating account…" : "Join"}
      </button>
    </form>
  );
}

export function SignInForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !email || !password) return;
    setBusy(true);
    setError(null);
    const data = await post("/api/members/login", { email, password, next });
    if (!data.ok) {
      setError(data.error ?? "Couldn’t sign in.");
      setBusy(false);
      return;
    }
    window.location.assign(typeof data.next === "string" ? data.next : "/me");
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field id="email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      <Field
        id="password"
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        required
      />
      <ErrorText error={error} />
      <button type="submit" disabled={busy || !email || !password} className={button}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export function RewardDetailsForm({ phone: p, tiktok: t }: { phone: string | null; tiktok: string | null }) {
  const [phone, setPhone] = useState(p ?? "");
  const [tiktok, setTiktok] = useState(t ? `@${t}` : "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const data = await post("/api/members/profile", { phone, tiktok });
    setBusy(false);
    if (!data.ok) return setMsg({ ok: false, text: data.error ?? "Couldn’t save." });
    if (typeof data.phone === "string") setPhone(data.phone);
    if (typeof data.tiktok === "string") setTiktok(`@${data.tiktok}`);
    setMsg({ ok: true, text: "Saved." });
    window.location.reload();
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field id="phone" label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" hint="Used only to verify you and pay rewards. No marketing texts. US numbers can skip the +1." />
      <Field
        id="tiktok"
        label="TikTok username"
        value={tiktok}
        onChange={(e) => setTiktok(e.target.value)}
        autoCapitalize="none"
        placeholder="@yourname"
        hint="The account you’ll post your scan videos from."
      />
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-[#1E6B45]" : "text-red-700"}`}>
          {msg.text}
        </p>
      )}
      <button type="submit" disabled={busy} className={button}>
        {busy ? "Saving…" : "Save details"}
      </button>
    </form>
  );
}
