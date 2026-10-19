import type { Metadata } from "next";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/app/live-state";
import { InvoiceDetail } from "@/components/billing/invoice-detail";

// Rendered behind the client-side auth gate in app/app/layout.tsx, so it is
// not part of the prerendered shell.
export const instant = false;

export const metadata: Metadata = { title: "Invoice" };

export default function InvoicePage() {
  // The invoice id is read on the client (useParams) inside this boundary.
  return (
    <Suspense fallback={<ListSkeleton />}>
      <InvoiceDetail />
    </Suspense>
  );
}
