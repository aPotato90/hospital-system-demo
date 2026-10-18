import { z } from "zod";
import { idSchema, type WithId } from "./common";
import { roleSchema } from "./roles";

export const AUDIT_ENTITY_TYPES = [
  "patient",
  "appointment",
  "consultation",
  "labOrder",
  "prescription",
  "invoice",
  "stockItem",
  "staff",
  "sandbox",
] as const;

export const AUDIT_ACTIONS = [
  "seed",
  "reset",
  "role.switch",
  "patient.register",
  "patient.update",
  "patient.delete",
  "patient.restore",
  "appointment.book",
  "appointment.status",
  "consultation.create",
  "consultation.update",
  "lab.collect",
  "lab.result",
  "lab.undo",
  "rx.dispense",
  "invoice.create",
  "invoice.update",
  "invoice.payment",
  "stock.create",
  "stock.update",
  "stock.receive",
  "stock.delete",
  "stock.restore",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

/** Readable labels for the activity feed and audit log screen. */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  seed: "Seeded demo data",
  reset: "Reset demo data",
  "role.switch": "Switched demo role",
  "patient.register": "Registered a patient",
  "patient.update": "Updated a patient",
  "patient.delete": "Deleted a patient",
  "patient.restore": "Restored a patient",
  "appointment.book": "Booked an appointment",
  "appointment.status": "Changed an appointment status",
  "consultation.create": "Recorded a consultation",
  "consultation.update": "Edited a consultation",
  "lab.collect": "Collected a lab sample",
  "lab.result": "Recorded a lab result",
  "lab.undo": "Undid a lab result",
  "rx.dispense": "Dispensed a prescription",
  "invoice.create": "Raised an invoice",
  "invoice.update": "Updated an invoice",
  "invoice.payment": "Recorded a payment",
  "stock.create": "Added a stock item",
  "stock.update": "Edited a stock item",
  "stock.receive": "Received stock",
  "stock.delete": "Deleted a stock item",
  "stock.restore": "Restored a stock item",
};

/**
 * Append-only entry under users/{uid}/auditLog/{entryId}. The rules allow
 * create only, with `at` equal to the server time.
 */
export const auditLogSchema = z.object({
  actorRole: roleSchema,
  action: z.enum(AUDIT_ACTIONS),
  entityType: z.enum(AUDIT_ENTITY_TYPES),
  entityId: idSchema,
  at: z.date(),
});
export type AuditLogData = z.infer<typeof auditLogSchema>;
export type AuditLogEntry = WithId<AuditLogData>;
