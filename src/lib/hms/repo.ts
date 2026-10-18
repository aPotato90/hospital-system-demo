import {
  collection,
  doc,
  Timestamp,
  type CollectionReference,
  type DocumentData,
  type DocumentReference,
  type Firestore,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
} from "firebase/firestore";
import type { z } from "zod";
import { appointmentSchema, type AppointmentData } from "./appointment";
import { auditLogSchema, type AuditLogData } from "./audit-log";
import type { WithId } from "./common";
import { consultationSchema, type ConsultationData } from "./consultation";
import { invoiceSchema, type InvoiceData } from "./invoice";
import { labOrderSchema, type LabOrderData } from "./lab-order";
import { labTestSchema, type LabTestData } from "./lab-test";
import { metaStateSchema, type MetaState } from "./meta";
import { patientSchema, type PatientData } from "./patient";
import { prescriptionSchema, type PrescriptionData } from "./prescription";
import { staffSchema, type StaffData } from "./staff";
import { stockItemSchema, type StockItemData } from "./stock-item";

/** Data type stored in each sandbox collection. */
export type EntityMap = {
  patients: PatientData;
  staff: StaffData;
  appointments: AppointmentData;
  consultations: ConsultationData;
  labTests: LabTestData;
  labOrders: LabOrderData;
  stockItems: StockItemData;
  prescriptions: PrescriptionData;
  invoices: InvoiceData;
  auditLog: AuditLogData;
};
export type CollectionName = keyof EntityMap;

export const SCHEMAS: { [C in CollectionName]: z.ZodType<EntityMap[C]> } = {
  patients: patientSchema,
  staff: staffSchema,
  appointments: appointmentSchema,
  consultations: consultationSchema,
  labTests: labTestSchema,
  labOrders: labOrderSchema,
  stockItems: stockItemSchema,
  prescriptions: prescriptionSchema,
  invoices: invoiceSchema,
  auditLog: auditLogSchema,
};

/** Collections that make up a sandbox, in a safe delete order. */
export const SANDBOX_COLLECTIONS = [
  "invoices",
  "prescriptions",
  "labOrders",
  "consultations",
  "appointments",
  "patients",
  "stockItems",
  "labTests",
  "staff",
] as const satisfies readonly CollectionName[];

/** Recursively replace Firestore Timestamps with Dates. */
export function timestampsToDates(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate();
  if (Array.isArray(value)) return value.map(timestampsToDates);
  if (value && typeof value === "object" && value.constructor === Object) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, timestampsToDates(v)]),
    );
  }
  return value;
}

/** Thrown when a stored document does not match its schema. */
export class InvalidDocumentError extends Error {
  constructor(
    readonly path: string,
    readonly issues: string,
  ) {
    super(`Document ${path} does not match its schema: ${issues}`);
    this.name = "InvalidDocumentError";
  }
}

function parseWith<T>(
  schema: z.ZodType<T>,
  path: string,
  data: DocumentData,
): T {
  const result = schema.safeParse(timestampsToDates(data));
  if (!result.success) {
    throw new InvalidDocumentError(
      path,
      result.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; "),
    );
  }
  return result.data;
}

/**
 * Converter that validates with Zod on read (Timestamps become Dates; pending
 * server timestamps are estimated) and strips the `id` on write.
 */
function converterFor<T>(
  schema: z.ZodType<T>,
): FirestoreDataConverter<WithId<T>, DocumentData> {
  return {
    toFirestore(model) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...data } = model as WithId<T> & Record<string, unknown>;
      return data as DocumentData;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions) {
      const data = snapshot.data({ serverTimestamps: "estimate", ...options });
      return { ...parseWith(schema, snapshot.ref.path, data), id: snapshot.id };
    },
  };
}

const converters = Object.fromEntries(
  Object.entries(SCHEMAS).map(([name, schema]) => [
    name,
    converterFor(schema as z.ZodType<unknown>),
  ]),
) as { [C in CollectionName]: FirestoreDataConverter<WithId<EntityMap[C]>> };

/** Typed reference to a sandbox collection. */
export function collectionRef<C extends CollectionName>(
  db: Firestore,
  uid: string,
  name: C,
): CollectionReference<WithId<EntityMap[C]>> {
  return collection(db, "users", uid, name).withConverter(converters[name]);
}

/** Typed reference to a sandbox document. */
export function docRef<C extends CollectionName>(
  db: Firestore,
  uid: string,
  name: C,
  id: string,
): DocumentReference<WithId<EntityMap[C]>> {
  return doc(db, "users", uid, name, id).withConverter(converters[name]);
}

/** Untyped reference for deletes, where no data is read or written. */
export function rawDocRef(
  db: Firestore,
  uid: string,
  name: CollectionName,
  id: string,
) {
  return doc(db, "users", uid, name, id);
}

/** A new random document id for a collection. */
export function newId(db: Firestore, uid: string, name: CollectionName) {
  return doc(collection(db, "users", uid, name)).id;
}

const metaConverter: FirestoreDataConverter<MetaState> = {
  toFirestore: (m) => m as DocumentData,
  fromFirestore: (snapshot, options) =>
    parseWith(
      metaStateSchema,
      snapshot.ref.path,
      snapshot.data({ serverTimestamps: "estimate", ...options }),
    ),
};

/** users/{uid}/meta/state */
export function metaStateRef(db: Firestore, uid: string) {
  return doc(db, "users", uid, "meta", "state").withConverter(metaConverter);
}
