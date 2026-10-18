"use client";

import { createContext, useContext } from "react";
import type { Firestore } from "firebase/firestore";
import type { MetaState } from "./meta";
import type { Role } from "./roles";

export type Sandbox = {
  db: Firestore;
  uid: string;
  meta: MetaState;
  role: Role;
  /** Persist the demo role (a UI demonstration, not access control). */
  setRole: (role: Role) => Promise<void>;
  /** Delete all sandbox data and seed it again. */
  resetDemo: () => Promise<void>;
  /**
   * Delete the sandbox (best effort) and sign out. Resolves to false when
   * some data could not be deleted.
   */
  signOut: () => Promise<boolean>;
};

export const SandboxContext = createContext<Sandbox | null>(null);

/** The signed-in visitor's sandbox. Only available inside the /app shell. */
export function useSandbox(): Sandbox {
  const sandbox = useContext(SandboxContext);
  if (!sandbox) throw new Error("useSandbox must be used inside the app shell");
  return sandbox;
}
