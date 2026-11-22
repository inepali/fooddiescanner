// Puts the public report link into a post description (pure; used by the server and the browser).

import { disclaimerEnd } from "./disclaimer.ts";

const MARKER = "Full ingredient breakdown:";

/**
 * Adds "Full ingredient breakdown: <url>" right after the disclaimer (or an
 * older "not medical advice" line), or at the end if there is neither. Does nothing without a link or
 * if the link is already in the text.
 */
export function withPublicLink(description: string, url: string | null | undefined): string {
  const text = description.trim();
  if (!url || text.includes(url)) return text;
  const line = `${MARKER} ${url}`;
  const at = disclaimerEnd(text);
  if (at < 0) return text ? `${text}\n\n${line}` : line;
  const rest = text.slice(at).trim();
  return `${text.slice(0, at)}\n\n${line}${rest ? `\n\n${rest}` : ""}`;
}
