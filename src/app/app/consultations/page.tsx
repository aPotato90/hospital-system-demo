import type { Metadata } from "next";
import { ComingSoon } from "@/components/app/coming-soon";

// Rendered behind the client-side auth gate in app/app/layout.tsx, so it is
// not part of the prerendered shell.
export const instant = false;

export const metadata: Metadata = { title: "Consultations" };

export default function ConsultationsPage() {
  return (
    <ComingSoon
      title="Consultations"
      description="The doctor's queue of checked-in patients and their consultation records."
      planned={[
        "A queue of today's checked-in patients by doctor",
        "Start a consultation (moves the appointment to in consultation)",
        "Notes, diagnosis, prescriptions and lab requests with the fake-data warning",
        "Complete the visit and raise the invoice",
      ]}
    />
  );
}
