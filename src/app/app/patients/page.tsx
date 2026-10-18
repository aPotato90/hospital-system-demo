import type { Metadata } from "next";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/app/live-state";
import { PatientsScreen } from "@/components/patients/patients-screen";

// Rendered behind the client-side auth gate in app/app/layout.tsx, so it is
// not part of the prerendered shell.
export const instant = false;

export const metadata: Metadata = { title: "Patients" };

export default function PatientsPage() {
  // The screen reads its search, sort and page from the URL.
  return (
    <Suspense fallback={<ListSkeleton />}>
      <PatientsScreen />
    </Suspense>
  );
}
