import type { Metadata } from "next";
import { ComingSoon } from "@/components/app/coming-soon";

// Rendered behind the client-side auth gate in app/app/layout.tsx, so it is
// not part of the prerendered shell.
export const instant = false;

export const metadata: Metadata = { title: "Pharmacy" };

export default function PharmacyPage() {
  return (
    <ComingSoon
      title="Pharmacy"
      description="Prescriptions waiting to be dispensed and stock levels."
      planned={[
        "Pending prescriptions queue and dispensing",
        "Stock list with reorder alerts",
        "Stock movement chart",
      ]}
    />
  );
}
