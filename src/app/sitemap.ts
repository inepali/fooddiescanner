import type { MetadataRoute } from "next";
import { supabase } from "@/lib/supabase";
import { orEmpty, publicScanIds } from "@/lib/library";

export const revalidate = 3600;

const SITE = process.env.SITE_URL ?? "https://www.fooddiescanner.com";

/** The public library: home, search, and every public scan's report. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const scans = await orEmpty(() => publicScanIds(supabase()), []);
  return [
    { url: `${SITE}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE}/search`, changeFrequency: "daily", priority: 0.8 },
    ...scans.map((s) => ({ url: `${SITE}/p/${s.id}`, lastModified: new Date(s.createdAt), changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
