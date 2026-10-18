"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserSessionPersistence,
  connectAuthEmulator,
  initializeAuth,
  type Auth,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  initializeFirestore,
  type Firestore,
} from "firebase/firestore";
import {
  firebaseConfig,
  isFirebaseConfigured,
  firebaseEmulatorsEnabled,
} from "./config";

type FirebaseClient = { app: FirebaseApp; auth: Auth; db: Firestore };

// Kept on globalThis so hot reloads in development reuse the same instances
// (connecting to the emulators twice throws).
const globalForFirebase = globalThis as typeof globalThis & {
  __hmsFirebase?: FirebaseClient;
};

/**
 * Lazily initialise the Firebase client SDK in the browser.
 * Returns null on the server or when the public config is missing, so callers
 * can show the not-configured screen instead of crashing.
 */
export function getFirebase(): FirebaseClient | null {
  if (typeof window === "undefined" || !isFirebaseConfigured) return null;
  if (globalForFirebase.__hmsFirebase) return globalForFirebase.__hmsFirebase;

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

  // Session persistence: the anonymous sandbox lasts for this browser tab.
  const auth = initializeAuth(app, {
    persistence: browserSessionPersistence,
  });
  const db = initializeFirestore(app, {});

  if (firebaseEmulatorsEnabled) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", {
      disableWarnings: true,
    });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
  }

  globalForFirebase.__hmsFirebase = { app, auth, db };
  return globalForFirebase.__hmsFirebase;
}
