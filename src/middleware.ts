import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, safeEqual, sessionSecret, verifySession } from "@/lib/session";

// Optional password for the private scanner. Required before you can connect Instagram / TikTok.
// Set APP_PASSWORD. Unset = open, as before. Signing in happens on /admin (a session cookie),
// not in the browser's password popup.
export async function middleware(req: NextRequest) {
  const secret = sessionSecret();
  if (!secret) return NextResponse.next();
  const path = req.nextUrl.pathname;

  // The public library: home, search and report pages (/p/<id>). They only ever show scans you turned public.
  if (path === "/" || path === "/search" || path.startsWith("/p/")) return NextResponse.next();
  if (path === "/robots.txt" || path === "/sitemap.xml") return NextResponse.next();
  // Rewards members: they have their own Supabase email + password sign-in, checked by each route.
  // /api/invites is NOT here: making invite codes stays behind APP_PASSWORD.
  if (path === "/join" || path === "/signin" || path === "/forgot" || path === "/reset" || path === "/me" || path.startsWith("/me/") || path.startsWith("/api/members/")) return NextResponse.next();
  // The sign-in page and its endpoints.
  if (path === "/admin" || path === "/api/auth/login" || path === "/api/auth/logout") return NextResponse.next();
  // Terms and Privacy must be public: TikTok, Google and Meta reviewers open them without a password.
  // The install manifest and icons are fetched without credentials, so they can't sit behind the password.
  if (/^\/(manifest\.webmanifest|icon-\d+\.png|apple-touch-icon\.png)$/.test(path)) return NextResponse.next();
  if (path === "/terms" || path === "/privacy" || path === "/scoring-rubric") return NextResponse.next();
  // The homepage contact form.
  if (path === "/api/contact") return NextResponse.next();
  // Card photos of public scans (the route itself refuses private ones).
  if (path.startsWith("/img/")) return NextResponse.next();

  if (await verifySession(secret, req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  // Scripts can still send APP_PASSWORD with HTTP Basic auth (any username); browsers never get the popup.
  const pass = process.env.APP_PASSWORD;
  const header = req.headers.get("authorization") ?? "";
  if (pass && header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      if (safeEqual(decoded.slice(decoded.indexOf(":") + 1), pass)) return NextResponse.next();
    } catch {
      // fall through
    }
  }

  if (path.startsWith("/api/")) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const login = new URL("/admin", req.url);
  login.searchParams.set("next", path + req.nextUrl.search);
  return NextResponse.redirect(login);
}

// Skip static files (icons, images, manifest) so they don't run the middleware function.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|webmanifest|txt|woff2?)$).*)"],
};
