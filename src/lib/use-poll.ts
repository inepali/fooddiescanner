"use client";

import { useEffect, useRef } from "react";

/**
 * Calls `fn` every `intervalMs` while the tab is visible and someone is using the page.
 * Each poll is a function invocation on Vercel, so a tab left open must not poll forever:
 * after `idleMs` with no input, polling pauses, and it resumes (with one immediate call)
 * on the next pointer/key input, focus, or the tab becoming visible again.
 */
export function usePoll(fn: () => void | Promise<void>, intervalMs: number, { enabled = true, idleMs = 5 * 60_000 } = {}) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) return;
    let lastActive = Date.now();
    let paused = false;
    let running = false;

    const tick = async () => {
      if (running || document.visibilityState !== "visible") return;
      if (Date.now() - lastActive > idleMs) {
        paused = true;
        return;
      }
      running = true;
      try {
        await fnRef.current();
      } finally {
        running = false;
      }
    };

    const wake = () => {
      lastActive = Date.now();
      if (paused && document.visibilityState === "visible") {
        paused = false;
        void tick();
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        lastActive = Date.now();
        paused = false;
        void tick();
      }
    };

    const events = ["pointerdown", "pointermove", "keydown", "focus"] as const;
    events.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(() => void tick(), intervalMs);
    return () => {
      clearInterval(timer);
      events.forEach((e) => window.removeEventListener(e, wake));
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, intervalMs, idleMs]);
}
