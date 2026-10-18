import type { Metadata } from "next";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/app/live-state";
import { AppointmentsScreen } from "@/components/appointments/appointments-screen";

// Rendered behind the client-side auth gate in app/app/layout.tsx, so it is
// not part of the prerendered shell.
export const instant = false;

export const metadata: Metadata = { title: "Appointments" };

export default function AppointmentsPage() {
  // The screen reads its view, date and filters from the URL.
  return (
    <Suspense fallback={<ListSkeleton />}>
      <AppointmentsScreen />
    </Suspense>
  );
}
