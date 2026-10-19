"use client";

import { addDays, startOfDay } from "date-fns";
import { MailIcon } from "lucide-react";
import { useMemo } from "react";
import { ErrorState, ListSkeleton } from "@/components/app/live-state";
import { PageHeader } from "@/components/app/page-header";
import { RoleGate } from "@/components/app/role-gate";
import { staffDisplayName } from "@/lib/format";
import { useCollection } from "@/lib/hms/hooks";
import { ROLE_LABELS, ROLES } from "@/lib/hms/roles";

export function StaffScreen() {
  const today = useMemo(() => startOfDay(new Date()), []);
  const staff = useCollection("staff");
  const appointments = useCollection("appointments", {
    where: [
      ["scheduledAt", ">=", today],
      ["scheduledAt", "<", addDays(today, 1)],
    ],
  });
  const todayCount = (doctorId: string) =>
    (appointments.data ?? []).filter(
      (a) => a.doctorId === doctorId && a.status !== "cancelled",
    ).length;
  const failed = staff.error ?? appointments.error;

  return (
    <RoleGate>
      <PageHeader
        title="Staff"
        description="The fictional team at Riverside Demo General Hospital. Emails are example.com addresses."
      />
      <div className="mt-6 space-y-6">
        {failed ? (
          <ErrorState
            error={failed}
            onRetry={() => {
              staff.retry();
              appointments.retry();
            }}
          />
        ) : staff.loading || appointments.loading ? (
          <ListSkeleton />
        ) : (
          ROLES.map((role) => {
            const people = (staff.data ?? [])
              .filter((s) => s.role === role)
              .sort((a, b) => a.name.localeCompare(b.name));
            if (people.length === 0) return null;
            return (
              <section key={role} aria-labelledby={`staff-${role}`}>
                <h2 id={`staff-${role}`} className="mb-2 text-sm font-semibold">
                  {ROLE_LABELS[role]}{" "}
                  <span className="text-muted-foreground">
                    ({people.length})
                  </span>
                </h2>
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {people.map((s) => (
                    <li
                      key={s.id}
                      className="rounded-xl border bg-card p-3 text-sm"
                    >
                      <p className="font-medium">{staffDisplayName(s)}</p>
                      <p className="text-muted-foreground">{s.department}</p>
                      <p className="mt-1 flex items-center gap-1 break-all text-muted-foreground">
                        <MailIcon
                          className="size-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        {s.email}
                      </p>
                      {role === "doctor" && (
                        <p className="mt-1">
                          {todayCount(s.id)} appointment
                          {todayCount(s.id) === 1 ? "" : "s"} today
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </div>
    </RoleGate>
  );
}
