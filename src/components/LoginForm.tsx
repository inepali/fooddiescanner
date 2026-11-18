"use client";

import { useState } from "react";

/** Admin sign-in for the private scanner (email + password, or the old single password). On success we go to `next`. */
export default function LoginForm({ next, withEmail = false }: { next: string; withEmail?: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || (withEmail && !email) || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, next }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; next?: string; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Couldn’t sign in. Try again.");
        setBusy(false);
        return;
      }
      // Full navigation so the new cookie is sent with every request from here on.
      window.location.assign(data.next ?? next);
    } catch {
      setError("Couldn’t reach the server. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {withEmail && (
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-medium text-neutral-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 w-full rounded-xl border bg-[#f2f2f7] px-4 text-base focus:border-accent focus:bg-white focus:outline-none"
          />
        </div>
      )}
      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-medium text-neutral-700">
          Password
        </label>
        <div className="flex items-center rounded-xl border bg-[#f2f2f7] focus-within:border-accent focus-within:bg-white">
          <input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            autoFocus={!withEmail}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "login-error" : undefined}
            className="h-12 min-w-0 flex-1 rounded-xl bg-transparent px-4 text-base focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="min-h-11 shrink-0 px-4 text-sm font-medium text-accent"
            aria-pressed={show}
          >
            {show ? "Hide" : "Show"}
          </button>
        </div>
        {error && (
          <p id="login-error" role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={!password || (withEmail && !email) || busy}
        className="flex h-12 w-full items-center justify-center rounded-xl bg-accent text-base font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
