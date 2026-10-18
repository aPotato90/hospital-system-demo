import {
  getDocs,
  query,
  where,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import {
  bookAppointmentFormSchema,
  combineDateTime,
  type Appointment,
  type BookAppointmentFormValues,
} from "./appointment";
import { addAuditEntry } from "./audit";
import { chunkWrites } from "./batches";
import type { PatientDeletionPlan, PatientRecords } from "./cascade";
import {
  nextPatientNo,
  patientFormSchema,
  type Patient,
  type PatientFormValues,
} from "./patient";
import {
  collectionRef,
  docRef,
  metaStateRef,
  newId,
  rawDocRef,
  timestampsToDates,
} from "./repo";
import type { Role } from "./roles";
import {
  APPOINTMENT_TRANSITIONS,
  canTransition,
  type AppointmentStatus,
} from "./transitions";

/**
 * Sandbox mutations. Each one validates its input, writes the change and its
 * audit entry in one batch, and returns once the server has accepted it.
 */

type Ctx = { db: Firestore; uid: string; role: Role };

export async function registerPatient(
  { db, uid, role }: Ctx,
  values: PatientFormValues,
  existingPatientNos: readonly string[],
): Promise<string> {
  const parsed = patientFormSchema.parse(values);
  const id = newId(db, uid, "patients");
  const batch = writeBatch(db);
  batch.set(docRef(db, uid, "patients", id), {
    id,
    ...parsed,
    patientNo: nextPatientNo(existingPatientNos),
    registeredAt: new Date(),
  });
  addAuditEntry(batch, db, uid, {
    actorRole: role,
    action: "patient.register",
    entityType: "patient",
    entityId: id,
  });
  await batch.commit();
  return id;
}

export async function updatePatient(
  { db, uid, role }: Ctx,
  patient: Patient,
  values: PatientFormValues,
) {
  const parsed = patientFormSchema.parse(values);
  const batch = writeBatch(db);
  batch.set(docRef(db, uid, "patients", patient.id), { ...patient, ...parsed });
  addAuditEntry(batch, db, uid, {
    actorRole: role,
    action: "patient.update",
    entityType: "patient",
    entityId: patient.id,
  });
  await batch.commit();
}

/** Fetch everything that references a patient, ready for the cascade planner. */
export async function loadPatientRecords(
  { db, uid }: Pick<Ctx, "db" | "uid">,
  patientId: string,
): Promise<PatientRecords> {
  const byPatient = <C extends keyof PatientRecords>(name: C) =>
    getDocs(
      query(collectionRef(db, uid, name), where("patientId", "==", patientId)),
    );
  const [appointments, consultations, labOrders, prescriptions, invoices] =
    await Promise.all([
      byPatient("appointments"),
      byPatient("consultations"),
      byPatient("labOrders"),
      byPatient("prescriptions"),
      byPatient("invoices"),
    ]);
  return {
    appointments: appointments.docs.map((d) => d.data()),
    consultations: consultations.docs.map((d) => d.data()),
    labOrders: labOrders.docs.map((d) => d.data()),
    prescriptions: prescriptions.docs.map((d) => d.data()),
    invoices: invoices.docs.map((d) => d.data()),
  } as PatientRecords;
}

export async function deletePatient(
  { db, uid, role }: Ctx,
  plan: PatientDeletionPlan,
) {
  if (plan.blockedReason) throw new Error(plan.blockedReason);
  const chunks = chunkWrites(plan.deletes, 499);
  for (const [i, chunk] of chunks.entries()) {
    const batch = writeBatch(db);
    chunk.forEach(({ collection, id }) =>
      batch.delete(rawDocRef(db, uid, collection, id)),
    );
    if (i === chunks.length - 1) {
      addAuditEntry(batch, db, uid, {
        actorRole: role,
        action: "patient.delete",
        entityType: "patient",
        entityId: plan.patientId,
      });
    }
    await batch.commit();
  }
}

/** Undo a delete by recreating every document from the plan's snapshot. */
export async function restorePatient(
  { db, uid, role }: Ctx,
  plan: PatientDeletionPlan,
) {
  const chunks = chunkWrites(plan.restore, 499);
  for (const [i, chunk] of chunks.entries()) {
    const batch = writeBatch(db);
    chunk.forEach(({ collection, id, data }) =>
      batch.set(
        rawDocRef(db, uid, collection, id),
        timestampsToDates(data) as object,
      ),
    );
    if (i === chunks.length - 1) {
      addAuditEntry(batch, db, uid, {
        actorRole: role,
        action: "patient.restore",
        entityType: "patient",
        entityId: plan.patientId,
      });
    }
    await batch.commit();
  }
}

export async function bookAppointment(
  { db, uid, role }: Ctx,
  values: BookAppointmentFormValues,
): Promise<string> {
  const parsed = bookAppointmentFormSchema.parse(values);
  const id = newId(db, uid, "appointments");
  const batch = writeBatch(db);
  batch.set(docRef(db, uid, "appointments", id), {
    id,
    patientId: parsed.patientId,
    doctorId: parsed.doctorId,
    department: parsed.department,
    scheduledAt: combineDateTime(parsed.date, parsed.time),
    status: "scheduled",
    reason: parsed.reason,
  });
  addAuditEntry(batch, db, uid, {
    actorRole: role,
    action: "appointment.book",
    entityType: "appointment",
    entityId: id,
  });
  await batch.commit();
  return id;
}

export async function setAppointmentStatus(
  { db, uid, role }: Ctx,
  appointment: Appointment,
  to: AppointmentStatus,
) {
  if (!canTransition(APPOINTMENT_TRANSITIONS, appointment.status, to)) {
    throw new Error(
      `An appointment cannot move from ${appointment.status} to ${to}.`,
    );
  }
  const batch = writeBatch(db);
  batch.update(rawDocRef(db, uid, "appointments", appointment.id), {
    status: to,
  });
  addAuditEntry(batch, db, uid, {
    actorRole: role,
    action: "appointment.status",
    entityType: "appointment",
    entityId: appointment.id,
  });
  await batch.commit();
}

/** Persist the demo role (a UI demonstration only, not access control). */
export async function saveActiveRole({ db, uid, role: from }: Ctx, to: Role) {
  const batch = writeBatch(db);
  batch.update(metaStateRef(db, uid).withConverter(null), { activeRole: to });
  addAuditEntry(batch, db, uid, {
    actorRole: from,
    action: "role.switch",
    entityType: "sandbox",
    entityId: uid,
  });
  await batch.commit();
}
