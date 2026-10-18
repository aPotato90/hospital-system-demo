"use client";

import { onSnapshot } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/firebase/auth-provider";
import { getFirebase } from "@/lib/firebase/client";
import { saveActiveRole } from "@/lib/hms/actions";
import type { MetaState } from "@/lib/hms/meta";
import { metaStateRef } from "@/lib/hms/repo";
import type { Role } from "@/lib/hms/roles";
import { SandboxContext, type Sandbox } from "@/lib/hms/sandbox-context";
import { resetDemoData, seedDemoData } from "@/lib/hms/seed";
import { ErrorState, FullPageLoading } from "./live-state";

type Phase =
  | { kind: "loading" }
  | { kind: "seeding" }
  | { kind: "resetting" }
  | { kind: "signing-out" }
  | { kind: "ready"; meta: MetaState }
  | { kind: "error"; error: Error };

// Seeding, resetting and signing out are never started twice for the same
// sandbox. The lock lives outside React: it is not render state, and the
// snapshot listener and the action callbacks all need the same instance.
const locks = new Map<string, { current: boolean }>();
function lockFor(uid: string) {
  let lock = locks.get(uid);
  if (!lock) {
    lock = { current: false };
    locks.set(uid, lock);
  }
  return lock;
}

/**
 * Watches users/{uid}/meta/state, seeds the sandbox on first entry and
 * provides the sandbox (db, uid, role, actions) to the app.
 */
export function SandboxProvider({
  uid,
  children,
}: {
  uid: string;
  children: React.ReactNode;
}) {
  const db = getFirebase()!.db;
  const { signOutAndDelete } = useAuth();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [pendingRole, setPendingRole] = useState<Role | null>(null);

  useEffect(() => {
    const runSeed = () => {
      lockFor(uid).current = true;
      setPhase({ kind: "seeding" });
      seedDemoData(db, uid)
        .then(() => {
          lockFor(uid).current = false;
          // Snapshots that arrived while seeding were ignored; re-subscribe.
          setAttempt((a) => a + 1);
        })
        .catch((e: unknown) => {
          lockFor(uid).current = false;
          setPhase({
            kind: "error",
            error: e instanceof Error ? e : new Error(String(e)),
          });
        });
    };

    return onSnapshot(
      metaStateRef(db, uid),
      (snap) => {
        if (lockFor(uid).current) return;
        let meta: MetaState | null = null;
        try {
          meta = snap.exists() ? snap.data() : null;
        } catch (e) {
          setPhase({ kind: "error", error: e as Error });
          return;
        }
        if (!meta?.seeded) runSeed();
        else setPhase({ kind: "ready", meta });
      },
      (error) => {
        if (!lockFor(uid).current) setPhase({ kind: "error", error });
      },
    );
  }, [db, uid, attempt]);

  const meta = phase.kind === "ready" ? phase.meta : null;
  const role = pendingRole ?? meta?.activeRole ?? "receptionist";

  const setRole = useCallback(
    async (next: Role) => {
      if (!meta || next === (pendingRole ?? meta.activeRole)) return;
      setPendingRole(next);
      try {
        await saveActiveRole({ db, uid, role: meta.activeRole }, next);
      } finally {
        setPendingRole(null);
      }
    },
    [db, uid, meta, pendingRole],
  );

  const resetDemo = useCallback(async () => {
    if (lockFor(uid).current) return;
    lockFor(uid).current = true;
    setPhase({ kind: "resetting" });
    try {
      await resetDemoData(db, uid, role);
    } finally {
      lockFor(uid).current = false;
      // Re-subscribe to pick up the fresh meta document.
      setAttempt((a) => a + 1);
    }
  }, [db, uid, role]);

  const signOut = useCallback(async () => {
    // Deleting meta/state must not trigger the first-entry seed.
    lockFor(uid).current = true;
    setPhase({ kind: "signing-out" });
    return signOutAndDelete();
  }, [signOutAndDelete, uid]);

  const sandbox = useMemo<Sandbox | null>(
    () => (meta ? { db, uid, meta, role, setRole, resetDemo, signOut } : null),
    [db, uid, meta, role, setRole, resetDemo, signOut],
  );

  if (phase.kind === "error") {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-xl flex-1 px-4 py-16 outline-none"
      >
        <h1 className="sr-only">Demo sandbox error</h1>
        <ErrorState
          title="Could not open your demo sandbox"
          error={phase.error}
          onRetry={() => {
            setPhase({ kind: "loading" });
            setAttempt((a) => a + 1);
          }}
        />
      </main>
    );
  }
  if (phase.kind === "signing-out") {
    return <FullPageLoading title="Deleting your sandbox and signing out" />;
  }
  if (phase.kind === "seeding" || phase.kind === "resetting") {
    return (
      <FullPageLoading
        title={
          phase.kind === "seeding"
            ? "Preparing your demo hospital"
            : "Resetting demo data"
        }
        detail="Creating fake patients, staff, appointments and records in your private sandbox."
      />
    );
  }
  if (!sandbox) return <FullPageLoading title="Opening your sandbox" />;

  return <SandboxContext value={sandbox}>{children}</SandboxContext>;
}
