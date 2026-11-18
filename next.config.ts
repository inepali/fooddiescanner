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
  experimental: {
    // Label photos and product videos can be large.
    serverActions: { bodySizeLimit: "50mb" },
  },
};

export default nextConfig;
