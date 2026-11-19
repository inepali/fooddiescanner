import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ffmpeg-static ships a binary; keep it out of the bundle but include it in the render function.
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: {
    "/api/scans/[id]/render": ["./node_modules/ffmpeg-static/ffmpeg", "./assets/fonts/**"],
  },
  // The admin sign-in moved from /login to /admin; old links and bookmarks still land there.
  async redirects() {
    return [{ source: "/login", destination: "/admin", permanent: true }];
  },
  // Card thumbnails: resized once by Vercel's image optimizer and kept for a year
  // (the /img/<media id> source never changes for a given id).
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000,
    localPatterns: [{ pathname: "/img/**" }],
  },
  experimental: {
    // Label photos and product videos can be large.
    serverActions: { bodySizeLimit: "50mb" },
  },
};

export default nextConfig;
