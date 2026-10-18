import {
  collection,
  deleteDoc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
  type DocumentReference,
  type Firestore,
} from "firebase/firestore";
import { addAuditEntry } from "./audit";
import { chunkWrites } from "./batches";
import {
  docRef,
  metaStateRef,
  rawDocRef,
  SANDBOX_COLLECTIONS,
  type CollectionName,
} from "./repo";
import type { Role } from "./roles";
import { generateSeedData, type SeedData } from "./seed-generator";

type SetOp = { ref: DocumentReference<unknown>; data: unknown };

function seedWrites(db: Firestore, uid: string, data: SeedData): SetOp[] {
  return (Object.keys(data) as (keyof SeedData & CollectionName)[]).flatMap(
    (name) =>
      data[name].map((entity) => ({
        ref: docRef(db, uid, name, entity.id) as DocumentReference<unknown>,
        data: entity,
      })),
  );
}

/** Delete every sandbox document except the append-only audit log. */
export async function clearSandbox(db: Firestore, uid: string) {
  const refs: DocumentReference[] = [];
  for (const name of SANDBOX_COLLECTIONS) {
    const snap = await getDocs(collection(db, "users", uid, name));
    snap.forEach((d) => refs.push(rawDocRef(db, uid, name, d.id)));
  }
  for (const chunk of chunkWrites(refs)) {
    const batch = writeBatch(db);
    chunk.forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

async function writeSeed(
  db: Firestore,
  uid: string,
  activeRole: Role,
  action: "seed" | "reset",
) {
  const ops = seedWrites(db, uid, generateSeedData(new Date()));
  // The meta document and the audit entry go in the final batch, so a sandbox
  // only counts as seeded once every document is written.
  const chunks = chunkWrites(ops, 498);
  if (chunks.length === 0) chunks.push([]);
  for (const [i, chunk] of chunks.entries()) {
    const batch = writeBatch(db);
    chunk.forEach(({ ref, data }) => batch.set(ref, data));
    if (i === chunks.length - 1) {
      batch.set(rawMetaRef(db, uid), {
        seeded: true,
        seededAt: serverTimestamp(),
        activeRole,
      });
      addAuditEntry(batch, db, uid, {
        actorRole: activeRole,
        action,
        entityType: "sandbox",
        entityId: uid,
      });
    }
    await batch.commit();
  }
}

/**
 * Seed the visitor's sandbox once. Idempotent: a seeded sandbox is left alone,
 * and leftovers from an interrupted seed are cleared before writing.
 */
export async function seedDemoData(
  db: Firestore,
  uid: string,
): Promise<"seeded" | "already-seeded"> {
  const meta = await getDoc(metaStateRef(db, uid));
  if (meta.exists() && meta.data().seeded) return "already-seeded";
  const activeRole = meta.exists() ? meta.data().activeRole : "receptionist";
  await clearSandbox(db, uid);
  await writeSeed(db, uid, activeRole, "seed");
  return "seeded";
}

/** Delete all sandbox data and seed it again, keeping the active role. */
export async function resetDemoData(
  db: Firestore,
  uid: string,
  activeRole: Role,
) {
  await setDoc(metaStateRef(db, uid), {
    seeded: false,
    seededAt: null,
    activeRole,
  });
  await clearSandbox(db, uid);
  await writeSeed(db, uid, activeRole, "reset");
}

/**
 * Remove the visitor's sandbox (used before signing out). The audit log is
 * append-only under the rules, so its entries stay behind.
 */
export async function deleteSandbox(db: Firestore, uid: string) {
  await clearSandbox(db, uid);
  await deleteDoc(rawMetaRef(db, uid));
}

function rawMetaRef(db: Firestore, uid: string) {
  return metaStateRef(db, uid).withConverter(null);
}
