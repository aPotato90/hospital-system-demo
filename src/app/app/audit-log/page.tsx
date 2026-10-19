import type { Metadata } from "next";
import { Suspense } from "react";
import { AuditLogScreen } from "@/components/admin/audit-log-screen";
import { ListSkeleton } from "@/components/app/live-state";

// Rendered behind the client-side auth gate in app/app/layout.tsx, so it is
// not part of the prerendered shell.
export const instant = false;

export const metadata: Metadata = { title: "Audit log" };

export default function AuditLogPage() {
  // Filters are kept in the URL.
  return (
    <Suspense fallback={<ListSkeleton />}>
      <AuditLogScreen />
    </Suspense>
  );
}
