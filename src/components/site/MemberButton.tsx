"use client";

import { useEffect, useState } from "react";
import { MEMBER_HINT_COOKIE } from "@/lib/members";

const pill = "flex min-h-11 shrink-0 items-center rounded-full bg-[#14201A] px-5 text-[15px] font-semibold text-white hover:bg-[#2A3A31]";

/**
 * Header button: "Contributor login" for visitors, "Log out" (plus "My rewards") for signed-in members.
 * The header is static, so it reads a harmless hint cookie in the browser instead of checking the session
 * on the server. Clicking still goes through the real, httpOnly session.
 */
export default function MemberButton() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const check = () => setSignedIn(document.cookie.split(/;\s*/).some((c) => c === `${MEMBER_HINT_COOKIE}=1`));
    check();
    // Back/forward cache can show an old page after logging in or out elsewhere.
    window.addEventListener("pageshow", check);
    return () => window.removeEventListener("pageshow", check);
  }, []);

  if (!signedIn) {
    return (
      <a href="/signin" className={pill}>
        <span className="sm:hidden">Log in</span>
        <span className="hidden sm:inline">Contributor login</span>
      </a>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-4">
      <a href="/me" className="hidden text-[15px] font-semibold text-[#1E6B45] hover:underline sm:inline">
        My rewards
      </a>
      <form action="/api/members/logout" method="post">
        <button type="submit" className={pill}>
          Log out
        </button>
      </form>
    </div>
  );
}
