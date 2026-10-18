/**
 * Public Firebase web config. These NEXT_PUBLIC_ values are client identifiers,
 * not secrets; Firestore security rules are what protect the data.
 *
 * Each variable is read with a literal `process.env.NEXT_PUBLIC_...` access so
 * Next.js can inline it at build time.
 */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

/** Connect to the local Auth and Firestore emulators instead of production. */
export const firebaseEmulatorsEnabled =
  process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS === "true";

/** Variables that must be set for the client SDK to start. */
export const REQUIRED_FIREBASE_ENV = [
  ["NEXT_PUBLIC_FIREBASE_API_KEY", firebaseConfig.apiKey],
  ["NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", firebaseConfig.authDomain],
  ["NEXT_PUBLIC_FIREBASE_PROJECT_ID", firebaseConfig.projectId],
  ["NEXT_PUBLIC_FIREBASE_APP_ID", firebaseConfig.appId],
] as const;

export const missingFirebaseEnv: string[] = REQUIRED_FIREBASE_ENV.filter(
  ([, value]) => value.trim() === "",
).map(([name]) => name);

export const isFirebaseConfigured = missingFirebaseEnv.length === 0;

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
export const portfolioUrl = process.env.NEXT_PUBLIC_PORTFOLIO_URL ?? "";
