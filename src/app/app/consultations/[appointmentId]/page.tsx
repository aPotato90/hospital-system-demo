import type { Metadata } from "next";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/app/live-state";
import { ConsultationScreen } from "@/components/doctor/consultation-screen";

// Rendered behind the client-side auth gate in app/app/layout.tsx, so it is
// not part of the prerendered shell.
export const instant = false;

export const metadata: Metadata = { title: "Consultation" };

export default function ConsultationPage() {
  // The appointment id is read on the client (useParams) inside this boundary.
  return (
    <Suspense fallback={<ListSkeleton />}>
      <ConsultationScreen />
    </Suspense>
  );
}
