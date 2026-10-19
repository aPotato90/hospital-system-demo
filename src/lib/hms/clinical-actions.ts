import {
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import type { Appointment } from "./appointment";
import { addAuditEntry } from "./audit";
import { applyPayment, type PaymentFormValues } from "./billing";
import type {
  ConsultationSavePlan,
  ExistingConsultationRecords,
} from "./consultation-plan";
import { planDispense } from "./dispense";
import type { Invoice } from "./invoice";
import type { LabOrder } from "./lab-order";
import { nairaToKobo } from "./money";
import type { Prescription } from "./prescription";
import { collectionRef, docRef, newId, rawDocRef } from "./repo";
import type { Role } from "./roles";
import {
  makeReceiveStockSchema,
  stockItemFormSchema,
  type StockItem,
  type StockItemData,
  type StockItemFormValues,
} from "./stock-item";
import { canTransition, LAB_ORDER_TRANSITIONS } from "./transitions";
import { LIMITS } from "./common";

/**
 * Mutations for the doctor, lab, pharmacy and billing screens. Like the
 * reception actions, each one writes its documents and an audit entry in one
 * batch and resolves once the server has accepted it.
 */

type Ctx = { db: Firestore; uid: string; role: Role };

/** Everything already stored for an appointment's consultation. */
export async function loadConsultationRecords(
  { db, uid }: Pick<Ctx, "db" | "uid">,
  appointmentId: string,
): Promise<ExistingConsultationRecords> {
  const consultations = await getDocs(
    query(
      collectionRef(db, uid, "consultations"),
      where("appointmentId", "==", appointmentId),
    ),
  );
  const consultation = consultations.docs[0]?.data() ?? null;
  if (!consultation) {
    return {
      consultation: null,
      prescriptions: [],
      labOrders: [],
      invoice: null,
    };
  }
  const byConsultation = <C extends "prescriptions" | "labOrders" | "invoices">(
    name: C,
  ) =>
    getDocs(
      query(
        collectionRef(db, uid, name),
        where("consultationId", "==", consultation.id),
      ),
    );
  const [prescriptions, labOrders, invoices] = await Promise.all([
    byConsultation("prescriptions"),
    byConsultation("labOrders"),
    byConsultation("invoices"),
  ]);
  return {
    consultation,
    prescriptions: prescriptions.docs.map((d) => d.data() as Prescription),
    labOrders: labOrders.docs.map((d) => d.data() as LabOrder),
    invoice: (invoices.docs[0]?.data() as Invoice | undefined) ?? null,
  };
}

/** New document id generator for the consultation planner. */
export function idGenerator({ db, uid }: Pick<Ctx, "db" | "uid">) {
  return (
    collection: "consultations" | "prescriptions" | "labOrders" | "invoices",
  ) => newId(db, uid, collection);
}

/** Commit a consultation save plan in one batch (with its audit entries). */
export async function commitConsultationSave(
  { db, uid, role }: Ctx,
  appointment: Appointment,
  plan: ConsultationSavePlan,
) {
  const batch = writeBatch(db);
  for (const w of plan.writes) {
    if (w.op === "delete") batch.delete(rawDocRef(db, uid, w.collection, w.id));
    else batch.set(rawDocRef(db, uid, w.collection, w.id), w.data);
  }
  if (plan.completeAppointment) {
    batch.update(rawDocRef(db, uid, "appointments", appointment.id), {
      status: "completed",
    });
    addAuditEntry(batch, db, uid, {
      actorRole: role,
      action: "appointment.status",
      entityType: "appointment",
      entityId: appointment.id,
    });
  }
  addAuditEntry(batch, db, uid, {
    actorRole: role,
    action: plan.isNew ? "consultation.create" : "consultation.update",
    entityType: "consultation",
    entityId: plan.consultationId,
  });
  addAuditEntry(batch, db, uid, {
    actorRole: role,
    action: plan.isNew ? "invoice.create" : "invoice.update",
    entityType: "invoice",
    entityId: plan.invoiceId,
  });
  await batch.commit();
}

function assertLabMove(order: LabOrder, to: LabOrder["status"]) {
  if (
    !canTransition(LAB_ORDER_TRANSITIONS, order.status, to) ||
    order.status === to
  ) {
    throw new Error(`A lab order cannot move from ${order.status} to ${to}.`);
  }
}

export async function collectLabSample(
  { db, uid, role }: Ctx,
  order: LabOrder,
) {
  assertLabMove(order, "collected");
  const batch = writeBatch(db);
  batch.update(rawDocRef(db, uid, "labOrders", order.id), {
    status: "collected",
  });
  addAuditEntry(batch, db, uid, {
    actorRole: role,
    action: "lab.collect",
    entityType: "labOrder",
    entityId: order.id,
  });
  await batch.commit();
}

/** Record the result text and mark the order resulted (server time). */
export async function recordLabResult(
  { db, uid, role }: Ctx,
  order: LabOrder,
  resultText: string,
) {
  assertLabMove(order, "resulted");
  const text = resultText.trim();
  if (text.length === 0 || text.length > LIMITS.text) {
    throw new Error(`Enter a result of 1 to ${LIMITS.text} characters.`);
  }
  const batch = writeBatch(db);
  batch.update(rawDocRef(db, uid, "labOrders", order.id), {
    status: "resulted",
    resultText: text,
    resultedAt: serverTimestamp(),
  });
  addAuditEntry(batch, db, uid, {
    actorRole: role,
    action: "lab.result",
    entityType: "labOrder",
    entityId: order.id,
  });
  await batch.commit();
}

/** Admin "undo result": back to collected, result cleared. */
export async function undoLabResult({ db, uid, role }: Ctx, order: LabOrder) {
  assertLabMove(order, "collected");
  const batch = writeBatch(db);
  batch.update(rawDocRef(db, uid, "labOrders", order.id), {
    status: "collected",
    resultText: "",
    resultedAt: null,
  });
  addAuditEntry(batch, db, uid, {
    actorRole: role,
    action: "lab.undo",
    entityType: "labOrder",
    entityId: order.id,
  });
  await batch.commit();
}

/**
 * Dispense a prescription: mark it dispensed and take the quantity off the
 * stock item in the same batch (the rules check the stock drops by exactly
 * the prescribed quantity).
 */
export async function dispensePrescription(
  { db, uid, role }: Ctx,
  rx: Prescription,
  stock: StockItem | undefined,
) {
  const plan = planDispense(rx, stock);
  if (!plan.ok) throw new Error(plan.reason);
  const batch = writeBatch(db);
  batch.update(rawDocRef(db, uid, "prescriptions", rx.id), {
    status: "dispensed",
    dispensedAt: serverTimestamp(),
  });
  batch.update(rawDocRef(db, uid, "stockItems", rx.stockItemId), {
    quantity: plan.newQuantity,
  });
  addAuditEntry(batch, db, uid, {
    actorRole: role,
    action: "rx.dispense",
    entityType: "prescription",
    entityId: rx.id,
  });
  await batch.commit();
}

function stockDataFrom(
  values: StockItemFormValues,
  quantity: number,
): StockItemData {
  const parsed = stockItemFormSchema.parse(values);
  return {
    name: parsed.name,
    category: parsed.category,
    unit: parsed.unit,
    quantity,
    reorderLevel: parsed.reorderLevel,
    unitPriceKobo: nairaToKobo(parsed.unitPriceNaira),
  };
}

export async function createStockItem(
  { db, uid, role }: Ctx,
  values: StockItemFormValues,
) {
  const id = newId(db, uid, "stockItems");
  const data = stockDataFrom(
    values,
    stockItemFormSchema.parse(values).quantity,
  );
  const batch = writeBatch(db);
  batch.set(docRef(db, uid, "stockItems", id), { id, ...data });
  addAuditEntry(batch, db, uid, {
    actorRole: role,
    action: "stock.create",
    entityType: "stockItem",
    entityId: id,
  });
  await batch.commit();
  return id;
}

/** Edit an item's details. The count only changes by receiving or dispensing. */
export async function updateStockItem(
  { db, uid, role }: Ctx,
  item: StockItem,
  values: StockItemFormValues,
) {
  const batch = writeBatch(db);
  batch.set(docRef(db, uid, "stockItems", item.id), {
    id: item.id,
    ...stockDataFrom(values, item.quantity),
  });
  addAuditEntry(batch, db, uid, {
    actorRole: role,
    action: "stock.update",
    entityType: "stockItem",
    entityId: item.id,
  });
  await batch.commit();
}

export async function receiveStock(
  { db, uid, role }: Ctx,
  item: StockItem,
  received: number,
) {
  const { received: n } = makeReceiveStockSchema(item.quantity).parse({
    received,
  });
  const batch = writeBatch(db);
  batch.update(rawDocRef(db, uid, "stockItems", item.id), {
    quantity: item.quantity + n,
  });
  addAuditEntry(batch, db, uid, {
    actorRole: role,
    action: "stock.receive",
    entityType: "stockItem",
    entityId: item.id,
  });
  await batch.commit();
}

/** Delete a stock item (the screen refuses while prescriptions still need it). */
export async function deleteStockItem({ db, uid, role }: Ctx, item: StockItem) {
  const batch = writeBatch(db);
  batch.delete(rawDocRef(db, uid, "stockItems", item.id));
  addAuditEntry(batch, db, uid, {
    actorRole: role,
    action: "stock.delete",
    entityType: "stockItem",
    entityId: item.id,
  });
  await batch.commit();
}

/** Undo a stock item delete by writing it back with the same id. */
export async function restoreStockItem(
  { db, uid, role }: Ctx,
  item: StockItem,
) {
  const batch = writeBatch(db);
  batch.set(docRef(db, uid, "stockItems", item.id), item);
  addAuditEntry(batch, db, uid, {
    actorRole: role,
    action: "stock.restore",
    entityType: "stockItem",
    entityId: item.id,
  });
  await batch.commit();
}

/** Record one payment (demo only: no money moves). One payment per write. */
export async function recordPayment(
  { db, uid, role }: Ctx,
  invoice: Invoice,
  values: PaymentFormValues,
) {
  const next = applyPayment(invoice, {
    amountKobo: nairaToKobo(values.amountNaira),
    method: values.method,
    at: new Date(),
  });
  const batch = writeBatch(db);
  batch.update(rawDocRef(db, uid, "invoices", invoice.id), {
    payments: next.payments,
    paidKobo: next.paidKobo,
    status: next.status,
  });
  addAuditEntry(batch, db, uid, {
    actorRole: role,
    action: "invoice.payment",
    entityType: "invoice",
    entityId: invoice.id,
  });
  await batch.commit();
  return next;
}
