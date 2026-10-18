import {
  collection,
  doc,
  serverTimestamp,
  type Firestore,
  type WriteBatch,
} from "firebase/firestore";
import type { AuditAction, AUDIT_ENTITY_TYPES } from "./audit-log";
import type { Role } from "./roles";

export type AuditInput = {
  actorRole: Role;
  action: AuditAction;
  entityType: (typeof AUDIT_ENTITY_TYPES)[number];
  entityId: string;
};

/** Add an append-only audit entry to a batch, stamped with the server time. */
export function addAuditEntry(
  batch: WriteBatch,
  db: Firestore,
  uid: string,
  entry: AuditInput,
) {
  const ref = doc(collection(db, "users", uid, "auditLog"));
  batch.set(ref, { ...entry, at: serverTimestamp() });
}
