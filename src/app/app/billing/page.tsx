import type { Metadata } from "next";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/app/live-state";
import { BillingScreen } from "@/components/billing/billing-screen";

// Rendered behind the client-side auth gate in app/app/layout.tsx, so it is
// not part of the prerendered shell.
export const instant = false;

export const metadata: Metadata = { title: "Billing" };

export default function BillingPage() {
  // Status filter and search are kept in the URL.
  return (
    <Suspense fallback={<ListSkeleton />}>
      <BillingScreen />
    </Suspense>
  );
}
