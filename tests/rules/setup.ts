import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import type { Firestore } from "firebase/firestore";

export const PROJECT_ID = "demo-hms";
export const ALICE = "alice-uid";
export const BOB = "bob-uid";

export async function createTestEnv(): Promise<RulesTestEnvironment> {
  const [host, port] = (
    process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080"
  ).split(":");
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(
        process.env.RULES_FILE ??
          new URL("../../firestore.rules", import.meta.url),
        "utf8",
      ),
      host,
      port: Number(port),
    },
  });
}

/** Modular Firestore for a signed-in user (the compat instance unwraps). */
export function dbAs(env: RulesTestEnvironment, uid: string): Firestore {
  return env
    .authenticatedContext(uid, { firebase: { sign_in_provider: "anonymous" } })
    .firestore() as unknown as Firestore;
}

export function anonDb(env: RulesTestEnvironment): Firestore {
  return env.unauthenticatedContext().firestore() as unknown as Firestore;
}
