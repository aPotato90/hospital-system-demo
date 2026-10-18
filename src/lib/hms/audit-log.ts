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
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

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
