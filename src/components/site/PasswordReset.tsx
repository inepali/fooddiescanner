"use client";

import { useEffect, useState } from "react";
import { MIN_PASSWORD } from "@/lib/members";

const input =
  "h-12 w-full rounded-xl border border-[#D8DED6] bg-white px-4 text-base text-[#14201A] focus:border-[#1E6B45] focus:outline-none";
const button =
  "flex h-12 w-full items-center justify-center rounded-xl bg-[#1E6B45] text-base font-semibold text-white disabled:opacity-50";

async function post(url: string, body: unknown): Promise<{ ok?: boolean; error?: string }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    return res.ok ? data : { ...data, ok: false };
  } catch {
    return { ok: false, error: "Couldn’t reach the server. Check your connection and try again." };
  }
}

export function ForgotForm({ admin }: { admin: boolean }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !email) return;
    setBusy(true);
    setError(null);
    const data = await post("/api/members/forgot", { email, to: admin ? "login" : undefined });
    setBusy(false);
    if (!data.ok) return setError(data.error ?? "Couldn’t send the email.");
    setSent(true);
  }

  if (sent) {
    return (
      <div role="status" className="space-y-2 rounded-2xl bg-[#E8F2EC] p-5">
        <p className="font-semibold">Check your email</p>
        <p className="text-[15px]">If {email} has an account, a reset link is on its way. It works once and expires in an hour.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-semibold">
          Email
        </label>
        <input id="email" type="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy || !email} className={button}>
        {busy ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}

export function ResetForm({ admin }: { admin: boolean }) {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const signIn = admin ? "/admin" : "/signin";
  const forgot = admin ? "/forgot?to=login" : "/forgot";

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    // Remove the one-time code from the address bar and history.
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname + window.location.search);
    if (hash.get("error")) {
      setLinkError(hash.get("error_code") === "otp_expired" ? "This reset link has expired or was already used." : "This reset link didn’t work.");
      setToken(null);
      return;
    }
    setToken(hash.get("type") === "recovery" ? hash.get("access_token") : null);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !token) return;
    if (password !== confirm) return setError("The two passwords don’t match.");
    setBusy(true);
    setError(null);
    const data = await post("/api/members/reset", { accessToken: token, password });
    setBusy(false);
    if (!data.ok) return setError(data.error ?? "Couldn’t save the new password.");
    setDone(true);
  }

  if (token === undefined) return <p className="text-[#5B6B60]">Checking your link…</p>;

  if (!token) {
    return (
      <div className="space-y-4">
        <p role="alert" className="text-[15px]">
          {linkError ?? "This page needs the link from your reset email."}
        </p>
        <a href={forgot} className={button}>
          Send a new link
        </a>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4">
        <p role="status" className="rounded-xl bg-[#E8F2EC] p-3 text-[15px]">
          Password updated.
        </p>
        <a href={signIn} className={button}>
          Sign in
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-semibold">
          New password
        </label>
        <input
          id="password"
          type="password"
          className={input}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          aria-describedby="password-hint"
          required
        />
        <p id="password-hint" className="text-[13px] text-[#5B6B60]">
          At least {MIN_PASSWORD} characters.
        </p>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="confirm" className="block text-sm font-semibold">
          Type it again
        </label>
        <input id="confirm" type="password" className={input} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy || !password || !confirm} className={button}>
        {busy ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}
