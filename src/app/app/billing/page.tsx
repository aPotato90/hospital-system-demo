import type { Metadata } from "next";
import { ComingSoon } from "@/components/app/coming-soon";

// Rendered behind the client-side auth gate in app/app/layout.tsx, so it is
// not part of the prerendered shell.
export const instant = false;

export const metadata: Metadata = { title: "Billing" };

export default function BillingPage() {
  return (
    <ComingSoon
      title="Billing"
      description="Invoices, balances and payments in naira."
      planned={[
        "Invoice list with unpaid, part-paid and paid filters",
        "Record cash, card or transfer payments one at a time",
        "Daily takings chart",
      ]}
    />
  );
}
