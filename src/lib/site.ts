// The public site address for links in posts. Always the real domain, never the *.vercel.app
// address the admin happens to be signed in on. Override with NEXT_PUBLIC_SITE_URL.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.fooddiescanner.com").replace(/\/$/, "");
