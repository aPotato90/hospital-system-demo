"use client";

import {
  onAuthStateChanged,
  signInAnonymously,
  signOut,
  type User,
} from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { deleteSandbox } from "@/lib/hms/seed";
import { getFirebase } from "./client";
import { isFirebaseConfigured } from "./config";

export type AuthStatus =
  "unconfigured" | "loading" | "signed-out" | "signed-in";

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  /** Start an anonymous demo session ("Explore the demo"). */
  signInAsGuest: () => Promise<void>;
  /**
   * Delete the visitor's sandbox (best effort), then sign out.
   * Resolves to false if some sandbox data could not be deleted.
   */
  signOutAndDelete: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    const firebase = getFirebase();
    if (!firebase) return;
    return onAuthStateChanged(firebase.auth, (next) => {
      setUser(next);
      setResolved(true);
    });
  }, []);

  const signInAsGuest = useCallback(async () => {
    const firebase = getFirebase();
    if (!firebase) throw new Error("Firebase is not configured");
    // Wait for a restored session first so a reload never replaces it.
    await firebase.auth.authStateReady();
    if (!firebase.auth.currentUser) await signInAnonymously(firebase.auth);
  }, []);

  const signOutAndDelete = useCallback(async () => {
    const firebase = getFirebase();
    if (!firebase) return true;
    const current = firebase.auth.currentUser;
    let deleted = true;
    if (current) {
      try {
        await deleteSandbox(firebase.db, current.uid);
      } catch {
        deleted = false;
      }
    }
    await signOut(firebase.auth);
    return deleted;
  }, []);

  const status: AuthStatus = !isFirebaseConfigured
    ? "unconfigured"
    : !resolved
      ? "loading"
      : user
        ? "signed-in"
        : "signed-out";

  const value = useMemo(
    () => ({ status, user, signInAsGuest, signOutAndDelete }),
    [status, user, signInAsGuest, signOutAndDelete],
  );
  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
