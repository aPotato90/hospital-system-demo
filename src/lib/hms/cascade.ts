import type { Appointment } from "./appointment";
import type { Consultation } from "./consultation";
import type { Invoice } from "./invoice";
import type { LabOrder } from "./lab-order";
import type { Patient } from "./patient";
import type { Prescription } from "./prescription";
import type { CollectionName } from "./repo";

/** Everything stored about one patient, as loaded before a delete. */
export type PatientRecords = {
  appointments: Appointment[];
  consultations: Consultation[];
  labOrders: LabOrder[];
  prescriptions: Prescription[];
  invoices: Invoice[];
};

export type CascadeCollection = keyof PatientRecords;

export type DocumentWrite = {
  collection: CollectionName;
  id: string;
  data: Record<string, unknown>;
};

export type PatientDeletionPlan = {
  patientId: string;
  /** Set when the delete must not go ahead; explains why. */
  blockedReason: string | null;
  /** Documents to delete, children before the patient. */
  deletes: { collection: CollectionName; id: string }[];
  counts: Record<CascadeCollection, number>;
  /** Writes that recreate exactly what was deleted (for Undo), parents first. */
  restore: DocumentWrite[];
};

/** Appointment statuses that mean the patient is in the building right now. */
const ACTIVE_VISIT = new Set(["checked-in", "in-consultation"]);

// Children are deleted first so a partial failure never leaves orphans that
// point at a missing parent; restore runs in the opposite order.
const DELETE_ORDER: CascadeCollection[] = [
  "invoices",
  "prescriptions",
  "labOrders",
  "consultations",
  "appointments",
];

function withoutId<T extends { id: string }>(item: T): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, ...data } = item;
  return data;
}

/**
 * Work out what deleting a patient involves. Pure: it only looks at the
 * records it is given, and only cascades to records that really belong to this
 * patient (by patientId, or through one of the patient's consultations).
 */
export function planPatientDeletion(
  patient: Patient,
  records: PatientRecords,
): PatientDeletionPlan {
  const appointments = records.appointments.filter(
    (a) => a.patientId === patient.id,
  );
  const consultations = records.consultations.filter(
    (c) => c.patientId === patient.id,
  );
  const consultationIds = new Set(consultations.map((c) => c.id));
  const belongs = (r: { patientId: string; consultationId: string }) =>
    r.patientId === patient.id || consultationIds.has(r.consultationId);

  const owned: PatientRecords = {
    appointments,
    consultations,
    labOrders: records.labOrders.filter(belongs),
    prescriptions: records.prescriptions.filter(belongs),
    invoices: records.invoices.filter(belongs),
  };

  const active = appointments.filter((a) => ACTIVE_VISIT.has(a.status));
  const blockedReason =
    active.length > 0
      ? `${patient.firstName} ${patient.lastName} has a visit in progress. Finish or cancel it before deleting.`
      : null;

  const deletes = [
    ...DELETE_ORDER.flatMap((collection) =>
      owned[collection].map((r) => ({ collection, id: r.id })),
    ),
    { collection: "patients" as const, id: patient.id },
  ];

  const restore: DocumentWrite[] = [
    { collection: "patients", id: patient.id, data: withoutId(patient) },
    ...[...DELETE_ORDER].reverse().flatMap((collection) =>
      owned[collection].map((r): DocumentWrite => ({
        collection,
        id: r.id,
        data: withoutId(r),
      })),
    ),
  ];

  return {
    patientId: patient.id,
    blockedReason,
    deletes,
    counts: {
      appointments: owned.appointments.length,
      consultations: owned.consultations.length,
      labOrders: owned.labOrders.length,
      prescriptions: owned.prescriptions.length,
      invoices: owned.invoices.length,
    },
    restore,
  };
}

/** Human summary such as "3 appointments, 1 consultation and 2 invoices". */
export function describeCascade(
  counts: Record<CascadeCollection, number>,
): string {
  const labels: Record<CascadeCollection, [string, string]> = {
    appointments: ["appointment", "appointments"],
    consultations: ["consultation", "consultations"],
    labOrders: ["lab order", "lab orders"],
    prescriptions: ["prescription", "prescriptions"],
    invoices: ["invoice", "invoices"],
  };
  const parts = (Object.keys(labels) as CascadeCollection[])
    .filter((k) => counts[k] > 0)
    .map((k) => `${counts[k]} ${labels[k][counts[k] === 1 ? 0 : 1]}`);
  if (parts.length === 0) return "no other records";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}
