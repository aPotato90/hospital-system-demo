import type { Metadata } from "next";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/app/live-state";
import { DoctorQueue } from "@/components/doctor/doctor-queue";

// Rendered behind the client-side auth gate in app/app/layout.tsx, so it is
// not part of the prerendered shell.
export const instant = false;

export const metadata: Metadata = { title: "My queue" };

export default function ConsultationsPage() {
  // The selected doctor is kept in the URL.
  return (
    <Suspense fallback={<ListSkeleton />}>
      <DoctorQueue />
    </Suspense>
  );
}
