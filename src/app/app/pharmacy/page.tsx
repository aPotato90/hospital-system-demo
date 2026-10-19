import type { Metadata } from "next";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/app/live-state";
import { PharmacyScreen } from "@/components/pharmacy/pharmacy-screen";

// Rendered behind the client-side auth gate in app/app/layout.tsx, so it is
// not part of the prerendered shell.
export const instant = false;

export const metadata: Metadata = { title: "Pharmacy" };

export default function PharmacyPage() {
  // The tab and stock filters are kept in the URL.
  return (
    <Suspense fallback={<ListSkeleton />}>
      <PharmacyScreen />
    </Suspense>
  );
}
