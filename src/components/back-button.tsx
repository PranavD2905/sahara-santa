"use client";

import { useRouter } from "next/navigation";

/**
 * Goes to the previous screen. When there's nothing to go back to in this
 * app (a shared link, a new tab), goes to `fallback` instead.
 */
export function BackButton({ fallback = "/" }: { fallback?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="mb-5 -ml-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-title text-xs tracking-[0.18em] text-cream/75 uppercase transition hover:bg-cream/10 hover:text-cream"
      onClick={() => {
        const cameFromApp =
          window.history.length > 1 &&
          document.referrer !== "" &&
          new URL(document.referrer).origin === window.location.origin;
        if (cameFromApp) router.back();
        else router.push(fallback);
      }}
    >
      ← Back
    </button>
  );
}
