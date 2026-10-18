"use client";

import { format, isToday } from "date-fns";
import {
  CalendarPlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Loader2Icon,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ErrorState, ListSkeleton } from "@/components/app/live-state";
import { PageHeader } from "@/components/app/page-header";
import { RoleGate } from "@/components/app/role-gate";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUrlUpdate } from "@/hooks/use-url-update";
import {
  formatDateTime,
  formatTime,
  staffDisplayName,
  toIsoDate,
} from "@/lib/format";
import { setAppointmentStatus } from "@/lib/hms/actions";
import type { Appointment } from "@/lib/hms/appointment";
import {
  appointmentRange,
  appointmentSearch,
  countByStatus,
  filterAppointments,
  groupByDay,
  parseAppointmentParams,
  shiftDate,
  type AppointmentListParams,
} from "@/lib/hms/appointment-query";
import { CLINICAL_DEPARTMENTS } from "@/lib/hms/common";
import { useById, useCollection } from "@/lib/hms/hooks";
import type { Patient } from "@/lib/hms/patient";
import { useSandbox } from "@/lib/hms/sandbox-context";
import type { Staff } from "@/lib/hms/staff";
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUSES,
  APPOINTMENT_TRANSITIONS,
  RECEPTION_ACTIONS,
  type AppointmentStatus,
} from "@/lib/hms/transitions";
import { cn } from "@/lib/utils";
import { BookAppointmentDialog } from "./book-appointment-dialog";
import { StatusBadge } from "./status-badge";

const ALL = "all";

type PendingAction = {
  appointment: Appointment;
  to: AppointmentStatus;
  label: string;
};

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <Select
        value={value ?? ALL}
        onValueChange={(v) => onChange(v === ALL ? null : v)}
      >
        <SelectTrigger id={id} className="h-9 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function AppointmentRow({
  appointment: a,
  patient,
  doctor,
  busy,
  onAction,
}: {
  appointment: Appointment;
  patient: Patient | undefined;
  doctor: Staff | undefined;
  busy: boolean;
  onAction: (action: PendingAction) => void;
}) {
  const actions = RECEPTION_ACTIONS.filter((x) =>
    APPOINTMENT_TRANSITIONS[a.status].includes(x.to),
  );
  const name = patient
    ? `${patient.firstName} ${patient.lastName}`
    : "Unknown patient";
  return (
    <li
      className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center"
      data-testid="appointment-row"
    >
      <div className="flex items-baseline gap-3 sm:w-20 sm:flex-col sm:gap-0">
        <time
          dateTime={a.scheduledAt.toISOString()}
          className="font-semibold tabular-nums"
        >
          {formatTime(a.scheduledAt)}
        </time>
        <span className="text-xs text-muted-foreground">{a.department}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {patient ? (
            <Link
              href={`/app/patients/${patient.id}`}
              className="rounded underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {name}
            </Link>
          ) : (
            name
          )}
          {patient && (
            <span className="ml-2 font-mono text-xs text-muted-foreground">
              {patient.patientNo}
            </span>
          )}
        </p>
        <p className="text-sm text-muted-foreground">
          {staffDisplayName(doctor)} · {a.reason}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={a.status} />
        {actions.map((x) => (
          <Button
            key={x.to}
            size="sm"
            variant={x.to === "checked-in" ? "default" : "outline"}
            disabled={busy}
            onClick={() =>
              onAction({ appointment: a, to: x.to, label: x.label })
            }
            aria-label={`${x.label}: ${name} at ${formatTime(a.scheduledAt)}`}
          >
            {x.label}
          </Button>
        ))}
      </div>
    </li>
  );
}

export function AppointmentsScreen() {
  const sandbox = useSandbox();
  const searchParams = useSearchParams();
  const params = parseAppointmentParams(
    new URLSearchParams(searchParams.toString()),
  );
  const updateUrl = useUrlUpdate();
  const { start, end } = appointmentRange(params);

  const appointments = useCollection("appointments", {
    where: [
      ["scheduledAt", ">=", start],
      ["scheduledAt", "<", end],
    ],
  });
  const patients = useCollection("patients");
  const staff = useCollection("staff");
  const patientById = useById(patients.data);
  const staffById = useById(staff.data);
  const doctors = useMemo(
    () => (staff.data ?? []).filter((s) => s.role === "doctor"),
    [staff.data],
  );

  const [bookOpen, setBookOpen] = useState(false);
  const [confirming, setConfirming] = useState<PendingAction | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const go = (next: Partial<AppointmentListParams>) =>
    updateUrl(appointmentSearch({ ...params, ...next }), "replace");

  const visible = useMemo(
    () => filterAppointments(appointments.data ?? [], params),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appointments.data, params.doctor, params.department, params.status],
  );
  const groups = groupByDay(visible, start, end);
  const counts = countByStatus(visible);

  async function run(action: PendingAction) {
    setConfirming(null);
    setBusyId(action.appointment.id);
    try {
      await setAppointmentStatus(sandbox, action.appointment, action.to);
      const p = patientById.get(action.appointment.patientId);
      toast.success(
        `${p ? `${p.firstName} ${p.lastName}` : "Appointment"}: ${APPOINTMENT_STATUS_LABELS[action.to].toLowerCase()}`,
      );
    } catch {
      toast.error("That status change is not allowed. Nothing was changed.");
    } finally {
      setBusyId(null);
    }
  }

  function onAction(action: PendingAction) {
    // Checking in is routine; cancelling and no-shows are confirmed.
    if (action.to === "checked-in") void run(action);
    else setConfirming(action);
  }

  const rangeLabel =
    params.view === "day"
      ? format(start, "EEEE d MMMM yyyy")
      : `${format(start, "d MMM")} – ${format(new Date(end.getTime() - 1), "d MMM yyyy")}`;

  const loading = appointments.loading || patients.loading || staff.loading;
  const failed = appointments.error ?? patients.error ?? staff.error;

  return (
    <RoleGate>
      <PageHeader
        title="Appointments"
        description="Book, check in and manage today's and upcoming visits."
        actions={
          <Button onClick={() => setBookOpen(true)}>
            <CalendarPlusIcon aria-hidden="true" />
            Book appointment
          </Button>
        }
      />

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap items-end gap-2">
          <div
            role="group"
            aria-label="View"
            className="inline-flex rounded-lg bg-muted p-0.5"
          >
            {(
              [
                ["day", "Day"],
                ["week", "Week"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                aria-pressed={params.view === v}
                onClick={() => go({ view: v })}
                className={cn(
                  "h-8 rounded-md px-3 text-sm font-medium focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  params.view === v
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => go({ date: shiftDate(params, -1) })}
            aria-label={
              params.view === "day" ? "Previous day" : "Previous week"
            }
          >
            <ChevronLeftIcon aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            onClick={() => go({ date: toIsoDate(new Date()) })}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => go({ date: shiftDate(params, 1) })}
            aria-label={params.view === "day" ? "Next day" : "Next week"}
          >
            <ChevronRightIcon aria-hidden="true" />
          </Button>
          <div>
            <label htmlFor="appointments-date" className="sr-only">
              Go to date
            </label>
            <Input
              id="appointments-date"
              type="date"
              value={params.date}
              onChange={(e) => e.target.value && go({ date: e.target.value })}
              className="h-8 w-40"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:w-[34rem]">
          <FilterSelect
            id="filter-doctor"
            label="Doctor"
            value={params.doctor}
            onChange={(doctor) => go({ doctor })}
            options={doctors.map((d) => ({
              value: d.id,
              label: staffDisplayName(d),
            }))}
          />
          <FilterSelect
            id="filter-department"
            label="Department"
            value={params.department}
            onChange={(department) =>
              go({
                department: department as AppointmentListParams["department"],
              })
            }
            options={CLINICAL_DEPARTMENTS.map((d) => ({ value: d, label: d }))}
          />
          <FilterSelect
            id="filter-status"
            label="Status"
            value={params.status}
            onChange={(status) =>
              go({ status: status as AppointmentStatus | null })
            }
            options={APPOINTMENT_STATUSES.map((s) => ({
              value: s,
              label: APPOINTMENT_STATUS_LABELS[s],
            }))}
          />
        </div>
      </div>

      <h2 className="mt-6 text-lg font-semibold" aria-live="polite">
        {rangeLabel}
      </h2>

      {failed ? (
        <div className="mt-3">
          <ErrorState
            error={failed}
            onRetry={() => {
              appointments.retry();
              patients.retry();
              staff.retry();
            }}
          />
        </div>
      ) : loading ? (
        <div className="mt-3">
          <ListSkeleton rows={4} />
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            {visible.length === 0
              ? "No appointments match."
              : `${visible.length} appointments · ${counts.scheduled} scheduled · ${counts["checked-in"]} checked in · ${counts.completed} completed`}
          </p>
          <div className="mt-4 space-y-6">
            {groups
              .filter((g) => params.view === "day" || g.items.length > 0)
              .map((g) => (
                <section
                  key={g.day.toISOString()}
                  aria-label={format(g.day, "EEEE d MMMM")}
                >
                  {params.view === "week" && (
                    <h3 className="mb-2 text-sm font-semibold">
                      {format(g.day, "EEEE d MMMM")}
                      {isToday(g.day) && (
                        <span className="ml-2 text-xs font-medium text-primary">
                          Today
                        </span>
                      )}
                    </h3>
                  )}
                  {g.items.length === 0 ? (
                    <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                      Nothing booked for this day.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {g.items.map((a) => (
                        <AppointmentRow
                          key={a.id}
                          appointment={a}
                          patient={patientById.get(a.patientId)}
                          doctor={staffById.get(a.doctorId)}
                          busy={busyId === a.id}
                          onAction={onAction}
                        />
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            {params.view === "week" && visible.length === 0 && (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nothing booked this week.
              </p>
            )}
          </div>
        </>
      )}

      <AlertDialog
        open={!!confirming}
        onOpenChange={(o) => !o && setConfirming(null)}
      >
        <AlertDialogContent>
          {confirming && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {confirming.to === "cancelled"
                    ? "Cancel this appointment?"
                    : "Mark as no-show?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {(() => {
                    const p = patientById.get(confirming.appointment.patientId);
                    return `${p ? `${p.firstName} ${p.lastName}` : "This patient"} at ${formatDateTime(confirming.appointment.scheduledAt)}. This cannot be undone.`;
                  })()}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep appointment</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => run(confirming)}
                >
                  {busyId && (
                    <Loader2Icon className="animate-spin" aria-hidden="true" />
                  )}
                  {confirming.label}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      <BookAppointmentDialog
        open={bookOpen}
        onOpenChange={setBookOpen}
        defaultDate={params.date}
        onBooked={(date) => go({ date })}
      />
    </RoleGate>
  );
}
