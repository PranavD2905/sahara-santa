"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { connectLiveUpdates, isLiveUpdatePath } from "@/lib/live-updates";

export function LiveUpdates() {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (isLiveUpdatePath(pathname)) return connectLiveUpdates(pathname, () => router.refresh());
  }, [pathname, router]);
  return null;
}
