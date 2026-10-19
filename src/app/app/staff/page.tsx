import type { Metadata } from "next";
import { StaffScreen } from "@/components/admin/staff-screen";

// Rendered behind the client-side auth gate in app/app/layout.tsx, so it is
// not part of the prerendered shell.
export const instant = false;

export const metadata: Metadata = { title: "Staff" };

export default function StaffPage() {
  return <StaffScreen />;
}
