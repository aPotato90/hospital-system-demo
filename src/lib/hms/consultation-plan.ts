import { z } from "zod";
import type { Appointment } from "./appointment";
import {
  idSchema,
  LIMITS,
  quantitySchema,
  shortTextSchema,
  textSchema,
} from "./common";
import type { Consultation, ConsultationData } from "./consultation";
import { CONSULTATION_FEES_KOBO } from "./fees";
import {
  sumLinesKobo,
  type Invoice,
  type InvoiceData,
  type InvoiceLine,
} from "./invoice";
import type { LabOrder, LabOrderData } from "./lab-order";
import type { LabTest } from "./lab-test";
import type { Prescription, PrescriptionData } from "./prescription";
import type { StockItem } from "./stock-item";
import { invoiceStatusFor } from "./transitions";

/**
 * Doctor's consultation form and the pure planning behind "Save and complete".
 * Nothing here suggests doses, diagnoses or interactions: the doctor types
 * everything; this only turns the form into documents.
 */

export const consultationFormSchema = z
  .object({
    notes: textSchema,
    diagnosis: textSchema.min(1, "Required"),
    prescriptions: z
      .array(
        z.object({
          stockItemId: idSchema.min(1, "Choose an item"),
          dose: shortTextSchema.min(1, "Required"),
          quantity: quantitySchema.min(1, "At least 1"),
        }),
      )
      .max(LIMITS.prescriptions, `At most ${LIMITS.prescriptions} items`),
    labRequests: z
      .array(z.object({ testId: idSchema.min(1, "Choose a test") }))
      .max(LIMITS.labRequests, `At most ${LIMITS.labRequests} tests`),
  })
  .superRefine((values, ctx) => {
    const seenItems = new Set<string>();
    values.prescriptions.forEach((p, i) => {
      if (p.stockItemId && seenItems.has(p.stockItemId)) {
        ctx.addIssue({
          code: "custom",
          path: ["prescriptions", i, "stockItemId"],
          message: "Already on this prescription",
        });
      }
      seenItems.add(p.stockItemId);
    });
    const seenTests = new Set<string>();
    values.labRequests.forEach((r, i) => {
      if (r.testId && seenTests.has(r.testId)) {
        ctx.addIssue({
          code: "custom",
          path: ["labRequests", i, "testId"],
          message: "Already requested",
        });
      }
      seenTests.add(r.testId);
    });
  });
export type ConsultationFormValues = z.infer<typeof consultationFormSchema>;

/** Records that already exist for a consultation (empty for a new one). */
export type ExistingConsultationRecords = {
  consultation: Consultation | null;
  prescriptions: Prescription[];
  labOrders: LabOrder[];
  invoice: Invoice | null;
};

/**
 * Why a saved consultation can no longer be edited, or null if it can.
 * Once medicine has left the pharmacy, a result exists, or money has been
 * taken, the record is final in the demo.
 */
export function consultationLockReason(
  records: ExistingConsultationRecords,
): string | null {
  if (records.prescriptions.some((p) => p.status === "dispensed")) {
    return "A prescription from this visit has been dispensed.";
  }
  if (records.labOrders.some((o) => o.status === "resulted")) {
    return "A lab result from this visit has been recorded.";
  }
  if (records.invoice && records.invoice.paidKobo > 0) {
    return "A payment has been recorded against this visit's invoice.";
  }
  return null;
}

type PricedItem = {
  description: string;
  quantity: number;
  unitPriceKobo: number;
};

/**
 * Invoice lines for a visit: the consultation fee, then one line per lab test
 * and per pharmacy item. If that would exceed the invoice line cap, the larger
 * group is folded into a single summary line (then the other, if needed).
 */
export function buildInvoiceLines(input: {
  department: Appointment["department"];
  labTests: PricedItem[];
  pharmacyItems: PricedItem[];
  maxLines?: number;
}): InvoiceLine[] {
  const maxLines = input.maxLines ?? LIMITS.invoiceLines;
  const consultation: InvoiceLine = {
    description: `${input.department} consultation`,
    quantity: 1,
    unitPriceKobo: CONSULTATION_FEES_KOBO[input.department],
    kind: "consultation",
  };
  const asLines = (
    items: PricedItem[],
    kind: InvoiceLine["kind"],
  ): InvoiceLine[] => items.map((i) => ({ ...i, kind }));
  const folded = (
    items: PricedItem[],
    kind: InvoiceLine["kind"],
    label: string,
  ): InvoiceLine[] =>
    items.length === 0
      ? []
      : [
          {
            description: `${label} (${items.length})`,
            quantity: 1,
            unitPriceKobo: items.reduce(
              (sum, i) => sum + i.quantity * i.unitPriceKobo,
              0,
            ),
            kind,
          },
        ];

  let lab = asLines(input.labTests, "lab");
  let pharmacy = asLines(input.pharmacyItems, "pharmacy");
  const count = () => 1 + lab.length + pharmacy.length;
  const foldLab = () =>
    (lab = folded(input.labTests, "lab", "Laboratory tests"));
  const foldPharmacy = () =>
    (pharmacy = folded(input.pharmacyItems, "pharmacy", "Pharmacy items"));
  if (count() > maxLines) {
    if (pharmacy.length >= lab.length) foldPharmacy();
    else foldLab();
  }
  if (count() > maxLines) {
    foldLab();
    foldPharmacy();
  }
  return [consultation, ...lab, ...pharmacy];
}

/** A document write in a consultation save, in order. */
export type ConsultationWrite =
  | {
      op: "set";
      collection: "consultations";
      id: string;
      data: ConsultationData;
    }
  | {
      op: "set";
      collection: "prescriptions";
      id: string;
      data: PrescriptionData;
    }
  | { op: "set"; collection: "labOrders"; id: string; data: LabOrderData }
  | { op: "set"; collection: "invoices"; id: string; data: InvoiceData }
  | { op: "delete"; collection: "prescriptions" | "labOrders"; id: string };

export type ConsultationSavePlan = {
  consultationId: string;
  invoiceId: string;
  isNew: boolean;
  writes: ConsultationWrite[];
  /** The appointment moves to completed on the first save. */
  completeAppointment: boolean;
};

export class ConsultationPlanError extends Error {}

/**
 * Turn the form into the exact set of writes for one batched save.
 *
 * New consultation: create it, one pending prescription per item, one
 * requested lab order per test, and the invoice; complete the appointment.
 * Edit: allowed only while unlocked (see consultationLockReason). Unchanged
 * prescriptions and lab orders keep their ids (a collected sample stays
 * collected); removed ones are deleted; new ones are created; the unpaid
 * invoice's lines are rebuilt.
 */
export function planConsultationSave(input: {
  appointment: Appointment;
  existing: ExistingConsultationRecords;
  values: ConsultationFormValues;
  stockById: ReadonlyMap<string, StockItem>;
  testById: ReadonlyMap<string, LabTest>;
  now: Date;
  newId: (
    collection: "consultations" | "prescriptions" | "labOrders" | "invoices",
  ) => string;
}): ConsultationSavePlan {
  const { appointment, existing, values, stockById, testById, now, newId } =
    input;
  const parsed = consultationFormSchema.parse(values);

  const isNew = existing.consultation === null;
  if (isNew && appointment.status !== "in-consultation") {
    throw new ConsultationPlanError("Start the consultation before saving it.");
  }
  if (!isNew) {
    const lock = consultationLockReason(existing);
    if (lock) throw new ConsultationPlanError(lock);
  }

  const items = parsed.prescriptions.map((p) => {
    const stock = stockById.get(p.stockItemId);
    if (!stock)
      throw new ConsultationPlanError(
        "A prescribed item is no longer in stock records.",
      );
    return { ...p, stock };
  });
  const tests = parsed.labRequests.map((r) => {
    const test = testById.get(r.testId);
    if (!test)
      throw new ConsultationPlanError(
        "A requested test is no longer in the catalogue.",
      );
    return test;
  });

  const consultationId = existing.consultation?.id ?? newId("consultations");
  const writes: ConsultationWrite[] = [];

  writes.push({
    op: "set",
    collection: "consultations",
    id: consultationId,
    data: {
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      notes: parsed.notes,
      diagnosis: parsed.diagnosis,
      prescriptions: items.map((i) => ({
        stockItemId: i.stockItemId,
        name: i.stock.name,
        dose: i.dose,
        quantity: i.quantity,
      })),
      labRequests: tests.map((t) => ({ testId: t.id, name: t.name })),
      createdAt: existing.consultation?.createdAt ?? now,
    },
  });

  // Prescriptions: keep identical pending ones, delete the rest, add new ones.
  const keptRx = new Set<string>();
  for (const i of items) {
    const same = existing.prescriptions.find(
      (p) =>
        !keptRx.has(p.id) &&
        p.stockItemId === i.stockItemId &&
        p.quantity === i.quantity,
    );
    if (same) {
      keptRx.add(same.id);
      continue;
    }
    writes.push({
      op: "set",
      collection: "prescriptions",
      id: newId("prescriptions"),
      data: {
        consultationId,
        patientId: appointment.patientId,
        stockItemId: i.stockItemId,
        name: i.stock.name,
        quantity: i.quantity,
        status: "pending",
        dispensedAt: null,
      },
    });
  }
  for (const p of existing.prescriptions) {
    if (!keptRx.has(p.id))
      writes.push({ op: "delete", collection: "prescriptions", id: p.id });
  }

  // Lab orders: keep orders for tests still requested (with their status).
  const keptLab = new Set<string>();
  for (const t of tests) {
    const same = existing.labOrders.find(
      (o) => !keptLab.has(o.id) && o.testId === t.id,
    );
    if (same) {
      keptLab.add(same.id);
      continue;
    }
    writes.push({
      op: "set",
      collection: "labOrders",
      id: newId("labOrders"),
      data: {
        consultationId,
        patientId: appointment.patientId,
        testId: t.id,
        name: t.name,
        status: "requested",
        resultText: "",
        resultedAt: null,
        priceKobo: t.priceKobo,
      },
    });
  }
  for (const o of existing.labOrders) {
    if (!keptLab.has(o.id))
      writes.push({ op: "delete", collection: "labOrders", id: o.id });
  }

  // Invoice: built from the current prices of what was requested.
  const lines = buildInvoiceLines({
    department: appointment.department,
    labTests: tests.map((t) => ({
      description: t.name,
      quantity: 1,
      unitPriceKobo: t.priceKobo,
    })),
    pharmacyItems: items.map((i) => ({
      description: i.stock.name,
      quantity: i.quantity,
      unitPriceKobo: i.stock.unitPriceKobo,
    })),
  });
  const totalKobo = sumLinesKobo(lines);
  const invoiceId = existing.invoice?.id ?? newId("invoices");
  writes.push({
    op: "set",
    collection: "invoices",
    id: invoiceId,
    data: {
      patientId: appointment.patientId,
      consultationId,
      lines,
      totalKobo,
      paidKobo: 0,
      status: invoiceStatusFor(totalKobo, 0),
      createdAt: existing.invoice?.createdAt ?? now,
      payments: [],
    },
  });

  return {
    consultationId,
    invoiceId,
    isNew,
    writes,
    completeAppointment: appointment.status === "in-consultation",
  };
}
