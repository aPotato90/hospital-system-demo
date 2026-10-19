"use client";

import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  PencilIcon,
  PhoneIcon,
  ShieldCheckIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/appointments/status-badge";
import { ErrorState, ListSkeleton } from "@/components/app/live-state";
import { RoleGate } from "@/components/app/role-gate";
import { LabResultsList } from "@/components/clinical/lab-results-list";
import { Button } from "@/components/ui/button";
import {
  formatAge,
  formatDate,
  formatDateTime,
  parseIsoDate,
  staffDisplayName,
} from "@/lib/format";
import { useById, useCollection, useDocument } from "@/lib/hms/hooks";
import { invoiceBalanceKobo } from "@/lib/hms/invoice";
import { formatNaira } from "@/lib/hms/money";
import { DeletePatientButton } from "./delete-patient-button";
import { PatientFormDialog } from "./patient-form-dialog";

function Section({
  id,
  title,
  children,
  className,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className={`rounded-xl border bg-card p-5 ${className ?? ""}`}
    >
      <h2 id={id} className="font-semibold">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

export function PatientDetail() {
  const { patientId } = useParams<{ patientId: string }>();
  const patient = useDocument("patients", patientId);
  const byPatient = { where: [["patientId", "==", patientId]] } as const;
  const appointments = useCollection("appointments", byPatient);
  const consultations = useCollection("consultations", byPatient);
  const invoices = useCollection("invoices", byPatient);
  const labOrders = useCollection("labOrders", byPatient);
  const staff = useCollection("staff");
  const staffById = useById(staff.data);
  const consultationByAppointment = useMemo(
    () => new Map((consultations.data ?? []).map((c) => [c.appointmentId, c])),
    [consultations.data],
  );
  const [editOpen, setEditOpen] = useState(false);

  const visits = useMemo(
    () =>
      [...(appointments.data ?? [])].sort(
        (a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime(),
      ),
    [appointments.data],
  );
  const bills = useMemo(
    () =>
      [...(invoices.data ?? [])].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      ),
    [invoices.data],
  );

  const back = (
    <Link
      href="/app/patients"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeftIcon className="size-4" aria-hidden="true" />
      All patients
    </Link>
  );

  if (patient.error) {
    return (
      <RoleGate>
        {back}
        <h1 className="sr-only">Patient</h1>
        <div className="mt-4">
          <ErrorState error={patient.error} onRetry={patient.retry} />
        </div>
      </RoleGate>
    );
  }
  if (patient.loading) return <ListSkeleton />;
  if (!patient.data) {
    return (
      <RoleGate>
        {back}
        <div className="mt-6 rounded-xl border p-6">
          <h1 className="text-lg font-semibold">Patient not found</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This patient may have been deleted from your sandbox.
          </p>
        </div>
      </RoleGate>
    );
  }

  const p = patient.data;
  const noAllergies = /^(none( known)?)?$/i.test(p.allergies.trim());
  const outstanding = bills.reduce((sum, i) => sum + invoiceBalanceKobo(i), 0);

  return (
    <RoleGate>
      {back}
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {p.firstName} {p.lastName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-mono">{p.patientNo}</span> ·{" "}
            {formatAge(p.dateOfBirth)} ·{" "}
            <span className="capitalize">{p.sex}</span> · Registered{" "}
            {formatDate(p.registeredAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <PencilIcon aria-hidden="true" />
            Edit
          </Button>
          <DeletePatientButton patient={p} />
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Section
          id="allergies-heading"
          title="Allergies"
          className="lg:order-2"
        >
          {noAllergies ? (
            <p className="flex items-center gap-2 text-sm">
              <ShieldCheckIcon
                className="size-4 text-primary"
                aria-hidden="true"
              />
              None known
            </p>
          ) : (
            <p className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-900 dark:bg-rose-950 dark:text-rose-100">
              <AlertTriangleIcon
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              {p.allergies}
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Fake demo record.
          </p>
        </Section>

        <Section
          id="profile-heading"
          title="Profile"
          className="lg:order-1 lg:col-span-2"
        >
          <dl className="grid gap-4 sm:grid-cols-2">
            <Detail label="Date of birth">
              {formatDate(parseIsoDate(p.dateOfBirth))}
            </Detail>
            <Detail label="Phone">
              <span className="inline-flex items-center gap-1">
                <PhoneIcon className="size-3.5" aria-hidden="true" />
                {p.phone}
              </span>
            </Detail>
            <Detail label="Address">{p.address}</Detail>
            <Detail label="Next of kin">
              {p.nextOfKin.name} · {p.nextOfKin.phone}
            </Detail>
          </dl>
        </Section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Section id="visits-heading" title="Visit history">
          {appointments.error ? (
            <ErrorState
              error={appointments.error}
              onRetry={appointments.retry}
            />
          ) : appointments.loading ? (
            <ListSkeleton rows={3} />
          ) : visits.length === 0 ? (
            <p className="text-sm text-muted-foreground">No visits yet.</p>
          ) : (
            <ul className="divide-y">
              {visits.map((a) => {
                const c = consultationByAppointment.get(a.id);
                return (
                  <li key={a.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">
                        {formatDateTime(a.scheduledAt)}
                      </p>
                      <StatusBadge status={a.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {a.department} ·{" "}
                      {staffDisplayName(staffById.get(a.doctorId))}
                    </p>
                    <p className="mt-1 text-sm">{a.reason}</p>
                    {c?.diagnosis && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Recorded: {c.diagnosis}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section id="invoices-heading" title="Invoices">
          {invoices.error ? (
            <ErrorState error={invoices.error} onRetry={invoices.retry} />
          ) : invoices.loading ? (
            <ListSkeleton rows={3} />
          ) : bills.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices yet.</p>
          ) : (
            <>
              <p className="text-sm">
                Outstanding balance:{" "}
                <strong className="tabular-nums">
                  {formatNaira(outstanding)}
                </strong>
              </p>
              <ul className="mt-3 divide-y">
                {bills.map((i) => (
                  <li key={i.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">
                        {formatDate(i.createdAt)}
                      </p>
                      <StatusBadge status={i.status} />
                    </div>
                    <dl className="mt-1 grid grid-cols-3 gap-2 text-sm text-muted-foreground">
                      <div>
                        <dt className="text-xs">Total</dt>
                        <dd className="text-foreground tabular-nums">
                          {formatNaira(i.totalKobo)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs">Paid</dt>
                        <dd className="text-foreground tabular-nums">
                          {formatNaira(i.paidKobo)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs">Balance</dt>
                        <dd className="text-foreground tabular-nums">
                          {formatNaira(invoiceBalanceKobo(i))}
                        </dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Section>
      </div>

      <div className="mt-4">
        <Section id="lab-results-heading" title="Lab results">
          {labOrders.error ? (
            <ErrorState error={labOrders.error} onRetry={labOrders.retry} />
          ) : labOrders.loading ? (
            <ListSkeleton rows={2} />
          ) : (
            <LabResultsList
              orders={[...(labOrders.data ?? [])].sort((a, b) =>
                a.status === b.status
                  ? a.name.localeCompare(b.name)
                  : a.status === "resulted"
                    ? 1
                    : -1,
              )}
              empty="No lab tests for this patient."
            />
          )}
        </Section>
      </div>

      <PatientFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        patient={p}
      />
    </RoleGate>
  );
}
