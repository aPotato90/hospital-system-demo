import type { Metadata } from "next";
import { ComingSoon } from "@/components/app/coming-soon";

// Rendered behind the client-side auth gate in app/app/layout.tsx, so it is
// not part of the prerendered shell.
export const instant = false;

export const metadata: Metadata = { title: "Staff" };

export default function StaffPage() {
  return (
    <ComingSoon
      title="Staff"
      description="The fictional staff list for Riverside Demo General Hospital."
      planned={[
        "Staff directory by role and department",
        "Workload per doctor",
      ]}
    />
  );
}
