"use client";

import { usePathname } from "next/navigation";
import { useCallback } from "react";

/**
 * Update the query string without a server round trip. Next.js syncs native
 * history calls with useSearchParams, so the URL stays the source of truth.
 */
export function useUrlUpdate() {
  const pathname = usePathname();
  return useCallback(
    (search: string, mode: "push" | "replace" = "replace") => {
      const url = `${pathname}${search}`;
      if (mode === "push") window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    },
    [pathname],
  );
}
