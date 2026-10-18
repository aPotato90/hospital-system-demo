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
  setRole: (role: Role) => Promise<void>;
};

export const SandboxContext = createContext<Sandbox | null>(null);

/** The signed-in visitor's sandbox. Only available inside the /app shell. */
export function useSandbox(): Sandbox {
  const sandbox = useContext(SandboxContext);
  if (!sandbox) throw new Error("useSandbox must be used inside the app shell");
  return sandbox;
}
