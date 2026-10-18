import type { Metadata } from "next";
import { ComingSoon } from "@/components/app/coming-soon";

// Rendered behind the client-side auth gate in app/app/layout.tsx, so it is
// not part of the prerendered shell.
export const instant = false;

export const metadata: Metadata = { title: "Audit log" };

export default function AuditLogPage() {
  return (
    <ComingSoon
      title="Audit log"
      description="The append-only demo audit trail for this sandbox."
      planned={[
        "Every recorded action with role, entity and time",
        "Filters by action and role",
      ]}
    />
  );
}
