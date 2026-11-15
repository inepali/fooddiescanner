import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "https://www.fooddiescanner.com"),
  title: { default: "Foodie Scanner — Know what’s really in your food", template: "%s · Foodie Scanner" },
  description:
    "A free, searchable library of food label breakdowns. Every scanned product is scored ingredient by ingredient, in plain English.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Foodie Scanner", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f2f2f7",
};

// Each route group adds its own frame: (app) is the private scanner tool, (site) is the public library.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
