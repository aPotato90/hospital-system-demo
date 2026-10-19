"use client";

import { addDays, startOfDay } from "date-fns";
import { Loader2Icon, PlayIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/appointments/status-badge";
import { DemoWorkflowNote } from "@/components/clinical/demo-workflow-note";
import { ErrorState, ListSkeleton } from "@/components/app/live-state";
import { PageHeader } from "@/components/app/page-header";
import { RoleGate } from "@/components/app/role-gate";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUrlUpdate } from "@/hooks/use-url-update";
import { formatTime, staffDisplayName } from "@/lib/format";
import { setAppointmentStatus } from "@/lib/hms/actions";
import type { Appointment } from "@/lib/hms/appointment";
import { useById, useCollection } from "@/lib/hms/hooks";
import { useSandbox } from "@/lib/hms/sandbox-context";
import type { AppointmentStatus } from "@/lib/hms/transitions";

/** Queue order: who is waiting first, then who is with the doctor. */
const GROUPS: { title: string; statuses: AppointmentStatus[] }[] = [
  { title: "Checked in, waiting", statuses: ["checked-in"] },
  { title: "In consultation", statuses: ["in-consultation"] },
  { title: "Still to arrive", statuses: ["scheduled"] },
  { title: "Completed", statuses: ["completed"] },
  { title: "Cancelled or no-show", statuses: ["cancelled", "no-show"] },
];

export function DoctorQueue() {
  const sandbox = useSandbox();
  const router = useRouter();
  const searchParams = useSearchParams();
  const updateUrl = useUrlUpdate();
  const today = useMemo(() => startOfDay(new Date()), []);
  const staff = useCollection("staff");
  const patients = useCollection("patients");
  const appointments = useCollection("appointments", {
    where: [
      ["scheduledAt", ">=", today],
      ["scheduledAt", "<", addDays(today, 1)],
    ],
  });
  const patientById = useById(patients.data);
  const doctors = useMemo(
    () =>
      (staff.data ?? [])
        .filter((s) => s.role === "doctor")
        .sort((a, b) => a.id.localeCompare(b.id)),
    [staff.data],
  );
  const requested = searchParams.get("doctor");
  const doctor = doctors.find((d) => d.id === requested) ?? doctors[0];
  const [starting, setStarting] = useState<string | null>(null);

  const mine = useMemo(
    () =>
      (appointments.data ?? [])
        .filter((a) => a.doctorId === doctor?.id)
        .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime()),
    [appointments.data, doctor],
  );

  async function start(a: Appointment) {
    setStarting(a.id);
    try {
      await setAppointmentStatus(sandbox, a, "in-consultation");
      router.push(`/app/consultations/${a.id}`);
    } catch {
      toast.error("Could not start the consultation. Try again.");
    } finally {
      // The queue stays mounted (hidden) after navigating; reset it.
      setStarting(null);
    }
  }

  const failed = staff.error ?? patients.error ?? appointments.error;
  const loading = staff.loading || patients.loading || appointments.loading;

  return (
    <RoleGate>
      <PageHeader
        title="My queue"
        description="Today's patients for the selected doctor, waiting patients first."
      />
      <div className="mt-4 space-y-4">
        <DemoWorkflowNote />
        <div className="max-w-xs">
          <label
            htmlFor="queue-doctor"
            className="mb-1.5 block text-sm font-medium"
          >
            Doctor (demo selector)
          </label>
          <Select
            value={doctor?.id ?? ""}
            onValueChange={(id) =>
              updateUrl(`?doctor=${encodeURIComponent(id)}`)
            }
          >
            <SelectTrigger id="queue-doctor" className="h-9 w-full">
              <SelectValue placeholder="Loading doctors…" />
            </SelectTrigger>
            <SelectContent>
              {doctors.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {staffDisplayName(d)} · {d.department}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {failed ? (
          <ErrorState
            error={failed}
            onRetry={() => {
              staff.retry();
              patients.retry();
              appointments.retry();
            }}
          />
        ) : loading ? (
          <ListSkeleton rows={4} />
        ) : mine.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No appointments today for {staffDisplayName(doctor)}.
          </p>
        ) : (
          GROUPS.map((group) => {
            const items = mine.filter((a) => group.statuses.includes(a.status));
            if (items.length === 0) return null;
            const headingId = `queue-${group.statuses[0]}`;
            return (
              <section key={group.title} aria-labelledby={headingId}>
                <h2 id={headingId} className="mb-2 text-sm font-semibold">
                  {group.title}{" "}
                  <span className="text-muted-foreground">
                    ({items.length})
                  </span>
                </h2>
                <ul className="space-y-2">
                  {items.map((a) => {
                    const p = patientById.get(a.patientId);
                    const name = p
                      ? `${p.firstName} ${p.lastName}`
                      : "Unknown patient";
                    return (
                      <li
                        key={a.id}
                        data-testid="queue-row"
                        className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center"
                      >
                        <time
                          dateTime={a.scheduledAt.toISOString()}
                          className="font-semibold tabular-nums sm:w-16"
                        >
                          {formatTime(a.scheduledAt)}
                        </time>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">
                            {name}
                            {p && (
                              <span className="ml-2 font-mono text-xs text-muted-foreground">
                                {p.patientNo}
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {a.reason}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={a.status} />
                          {a.status === "checked-in" && (
                            <Button
                              size="sm"
                              onClick={() => start(a)}
                              disabled={starting !== null}
                              aria-label={`Start consultation: ${name}`}
                            >
                              {starting === a.id ? (
                                <Loader2Icon
                                  className="animate-spin"
                                  aria-hidden="true"
                                />
                              ) : (
                                <PlayIcon aria-hidden="true" />
                              )}
                              Start consultation
                            </Button>
                          )}
                          {a.status === "in-consultation" && (
                            <Button asChild size="sm">
                              <Link
                                href={`/app/consultations/${a.id}`}
                                aria-label={`Open consultation: ${name}`}
                              >
                                Open consultation
                              </Link>
                            </Button>
                          )}
                          {a.status === "completed" && (
                            <Button asChild size="sm" variant="outline">
                              <Link
                                href={`/app/consultations/${a.id}`}
                                aria-label={`View consultation: ${name}`}
                              >
                                View
                              </Link>
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })
        )}
      </div>
    </RoleGate>
  );
}
