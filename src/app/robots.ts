import type { MetadataRoute } from "next";

const SITE = process.env.SITE_URL ?? "https://www.fooddiescanner.com";

/** Search engines may read the public library; the scanner tool and API stay out. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/search", "/p/"], disallow: ["/api/", "/scan", "/new/", "/scans/", "/history", "/m/", "/admin", "/review", "/invites"] }],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
