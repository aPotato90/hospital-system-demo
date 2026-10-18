import type { Metadata } from "next";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/app/live-state";
import { PatientDetail } from "@/components/patients/patient-detail";

// Rendered behind the client-side auth gate in app/app/layout.tsx, so it is
// not part of the prerendered shell.
export const instant = false;

export const metadata: Metadata = { title: "Patient" };

export default function PatientPage() {
  // The patient id is read on the client (useParams) inside this boundary.
  return (
    <Suspense fallback={<ListSkeleton />}>
      <PatientDetail />
    </Suspense>
  );
}
