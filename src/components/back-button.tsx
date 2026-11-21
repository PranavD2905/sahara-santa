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
      className="mb-4 inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
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
