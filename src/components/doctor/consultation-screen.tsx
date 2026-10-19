"use client";

import { ArrowLeftIcon, LockIcon, PencilIcon, PlayIcon } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/appointments/status-badge";
import { DemoWorkflowNote } from "@/components/clinical/demo-workflow-note";
import { LabResultsList } from "@/components/clinical/lab-results-list";
import { PatientSummary } from "@/components/clinical/patient-summary";
import { Section } from "@/components/clinical/section";
import { ErrorState, ListSkeleton } from "@/components/app/live-state";
import { RoleGate } from "@/components/app/role-gate";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime, staffDisplayName } from "@/lib/format";
import { setAppointmentStatus } from "@/lib/hms/actions";
import {
  consultationLockReason,
  type ConsultationFormValues,
} from "@/lib/hms/consultation-plan";
import type { Consultation } from "@/lib/hms/consultation";
import { useById, useCollection, useDocument } from "@/lib/hms/hooks";
import { invoiceBalanceKobo } from "@/lib/hms/invoice";
import { formatNaira } from "@/lib/hms/money";
import { useSandbox } from "@/lib/hms/sandbox-context";
import { ConsultationForm } from "./consultation-form";

const NONE = "__none__";

function formValuesFrom(c: Consultation | null): ConsultationFormValues {
  return c
    ? {
        notes: c.notes,
        diagnosis: c.diagnosis,
        prescriptions: c.prescriptions.map((p) => ({
          stockItemId: p.stockItemId,
          dose: p.dose,
          quantity: p.quantity,
        })),
        labRequests: c.labRequests.map((r) => ({ testId: r.testId })),
      }
    : { notes: "", diagnosis: "", prescriptions: [], labRequests: [] };
}

export function ConsultationScreen() {
  const sandbox = useSandbox();
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const appointment = useDocument("appointments", appointmentId);
  const patientId = appointment.data?.patientId ?? NONE;
  const patient = useDocument("patients", patientId);
  const staff = useCollection("staff");
  const stock = useCollection("stockItems");
  const labTests = useCollection("labTests");
  const history = useCollection("appointments", {
    where: [["patientId", "==", patientId]],
  });
  const patientConsultations = useCollection("consultations", {
    where: [["patientId", "==", patientId]],
  });
  const patientLabOrders = useCollection("labOrders", {
    where: [["patientId", "==", patientId]],
  });
  const consultation =
    patientConsultations.data?.find((c) => c.appointmentId === appointmentId) ??
    null;
  const consultationId = consultation?.id ?? NONE;
  const prescriptions = useCollection("prescriptions", {
    where: [["consultationId", "==", consultationId]],
  });
  const invoices = useCollection("invoices", {
    where: [["consultationId", "==", consultationId]],
  });
  const staffById = useById(staff.data);
  const consultationByAppointment = useMemo(
    () =>
      new Map(
        (patientConsultations.data ?? []).map((c) => [c.appointmentId, c]),
      ),
    [patientConsultations.data],
  );
  const [editing, setEditing] = useState(false);
  const [starting, setStarting] = useState(false);

  const live = [
    appointment,
    patient,
    staff,
    stock,
    labTests,
    history,
    patientConsultations,
    patientLabOrders,
    prescriptions,
    invoices,
  ];
  const failed = live.find((l) => l.error);
  const back = (
    <Link
      href="/app/consultations"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeftIcon className="size-4" aria-hidden="true" />
      My queue
    </Link>
  );

  if (failed?.error) {
    return (
      <RoleGate>
        {back}
        <h1 className="sr-only">Consultation</h1>
        <div className="mt-4">
          <ErrorState
            error={failed.error}
            onRetry={() => live.forEach((l) => l.retry())}
          />
        </div>
      </RoleGate>
    );
  }
  if (live.some((l) => l.loading)) return <ListSkeleton />;
  const a = appointment.data;
  const p = patient.data;
  if (!a || !p) {
    return (
      <RoleGate>
        {back}
        <div className="mt-6 rounded-xl border p-6">
          <h1 className="text-lg font-semibold">Appointment not found</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            It may have been deleted from your sandbox.
          </p>
        </div>
      </RoleGate>
    );
  }

  const orders = (patientLabOrders.data ?? []).filter(
    (o) => o.consultationId === consultationId,
  );
  const invoice = invoices.data?.[0] ?? null;
  const lock = consultation
    ? consultationLockReason({
        consultation,
        prescriptions: prescriptions.data ?? [],
        labOrders: orders,
        invoice,
      })
    : null;
  const previous = [...(history.data ?? [])]
    .filter((h) => h.id !== a.id && h.scheduledAt < a.scheduledAt)
    .sort((x, y) => y.scheduledAt.getTime() - x.scheduledAt.getTime());
  const priorResults = (patientLabOrders.data ?? []).filter(
    (o) => o.consultationId !== consultationId && o.status === "resulted",
  );

  async function start() {
    setStarting(true);
    try {
      await setAppointmentStatus(sandbox, a!, "in-consultation");
    } catch {
      toast.error("Could not start the consultation. Try again.");
    } finally {
      setStarting(false);
    }
  }

  const showForm = (a.status === "in-consultation" && !consultation) || editing;

  return (
    <RoleGate>
      {back}
      <div className="mt-3 space-y-4">
        <PatientSummary
          patient={p}
          title={`Consultation · ${formatDateTime(a.scheduledAt)}`}
        />
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <StatusBadge status={a.status} />
          {a.department} · {staffDisplayName(staffById.get(a.doctorId))} ·
          Reason: {a.reason}
        </p>
        <DemoWorkflowNote />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {a.status === "checked-in" && (
            <Section id="start-heading" title="Ready to start">
              <p className="text-sm text-muted-foreground">
                The patient is checked in. Start the consultation to record it.
              </p>
              <Button className="mt-3" onClick={start} disabled={starting}>
                <PlayIcon aria-hidden="true" />
                Start consultation
              </Button>
            </Section>
          )}
          {(a.status === "scheduled" ||
            a.status === "cancelled" ||
            a.status === "no-show") && (
            <Section id="unavailable-heading" title="No consultation">
              <p className="text-sm text-muted-foreground">
                This appointment is{" "}
                {a.status === "scheduled" ? "not checked in yet" : a.status}.
                Reception checks patients in from the appointment book.
              </p>
            </Section>
          )}
          {showForm && (
            <Section
              id="form-heading"
              title={editing ? "Edit consultation" : "Record consultation"}
            >
              <ConsultationForm
                appointment={a}
                stockItems={stock.data ?? []}
                labTests={labTests.data ?? []}
                defaultValues={formValuesFrom(consultation)}
                editing={editing}
                onDone={() => setEditing(false)}
              />
            </Section>
          )}
          {consultation && !editing && (
            <Section
              id="record-heading"
              title="Consultation record"
              actions={
                lock ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <LockIcon className="size-3.5" aria-hidden="true" />
                    Read-only
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing(true)}
                  >
                    <PencilIcon aria-hidden="true" />
                    Edit
                  </Button>
                )
              }
            >
              {lock && (
                <p className="mb-3 text-sm text-muted-foreground">{lock}</p>
              )}
              <dl className="grid gap-3 text-sm">
                <div>
                  <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Diagnosis
                  </dt>
                  <dd className="mt-0.5">{consultation.diagnosis}</dd>
                </div>
                {consultation.notes && (
                  <div>
                    <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Notes
                    </dt>
                    <dd className="mt-0.5 whitespace-pre-line">
                      {consultation.notes}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Prescriptions
                  </dt>
                  <dd className="mt-1">
                    {consultation.prescriptions.length === 0 ? (
                      "None"
                    ) : (
                      <ul className="space-y-1">
                        {consultation.prescriptions.map((item) => {
                          const doc = prescriptions.data?.find(
                            (r) => r.stockItemId === item.stockItemId,
                          );
                          return (
                            <li
                              key={item.stockItemId}
                              className="flex flex-wrap items-center gap-2"
                            >
                              <span>
                                {item.name} × {item.quantity}: {item.dose}
                              </span>
                              {doc && <StatusBadge status={doc.status} />}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </dd>
                </div>
              </dl>
            </Section>
          )}
          {consultation && (
            <Section id="results-heading" title="Lab requests and results">
              <LabResultsList orders={orders} />
            </Section>
          )}
          {invoice && (
            <Section id="invoice-heading" title="Invoice">
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <StatusBadge status={invoice.status} />
                Total {formatNaira(invoice.totalKobo)} · Balance{" "}
                {formatNaira(invoiceBalanceKobo(invoice))}
              </p>
            </Section>
          )}
        </div>

        <div className="space-y-4">
          <Section id="history-heading" title="Visit history">
            {previous.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No earlier visits.
              </p>
            ) : (
              <ul className="divide-y">
                {previous.slice(0, 8).map((h) => (
                  <li key={h.id} className="py-2 text-sm first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">
                        {formatDate(h.scheduledAt)}
                      </span>
                      <StatusBadge status={h.status} />
                    </div>
                    <p className="text-muted-foreground">
                      {h.department} · {h.reason}
                    </p>
                    {consultationByAppointment.get(h.id)?.diagnosis && (
                      <p>
                        Recorded:{" "}
                        {consultationByAppointment.get(h.id)!.diagnosis}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section id="prior-results-heading" title="Earlier lab results">
            <LabResultsList
              orders={priorResults.slice(0, 6)}
              empty="No earlier results."
            />
          </Section>
        </div>
      </div>
    </RoleGate>
  );
}
