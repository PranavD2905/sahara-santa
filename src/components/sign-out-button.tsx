"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      className="rounded-md px-2 py-1 font-title text-[11px] tracking-[0.18em] text-cream/70 uppercase transition hover:bg-cream/10 hover:text-cream"
      onClick={async () => {
        await authClient.signOut();
        router.replace("/");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
