import type { Metadata } from "next";
import { ComingSoon } from "@/components/app/coming-soon";

// Rendered behind the client-side auth gate in app/app/layout.tsx, so it is
// not part of the prerendered shell.
export const instant = false;

export const metadata: Metadata = { title: "Lab orders" };

export default function LabPage() {
  return (
    <ComingSoon
      title="Lab orders"
      description="Requested, collected and resulted tests across the hospital."
      planned={[
        "Worklist of requested and collected samples",
        "Collect a sample and record a result (requested → collected → resulted)",
        "Turnaround charts",
      ]}
    />
  );
}
