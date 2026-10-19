import type { Metadata } from "next";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/app/live-state";
import { LabScreen } from "@/components/lab/lab-screen";

// Rendered behind the client-side auth gate in app/app/layout.tsx, so it is
// not part of the prerendered shell.
export const instant = false;

export const metadata: Metadata = { title: "Lab orders" };

export default function LabPage() {
  // Status tab, filters and search are kept in the URL.
  return (
    <Suspense fallback={<ListSkeleton />}>
      <LabScreen />
    </Suspense>
  );
}
