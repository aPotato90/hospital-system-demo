"use client";

import { NotConfigured } from "@/components/not-configured";
import { useAuth } from "@/lib/firebase/auth-provider";
import { AppShell } from "./app-shell";
import { FullPageLoading } from "./live-state";
import { SandboxProvider } from "./sandbox-provider";
import { SignedOut } from "./signed-out";

/** Client-side gate for /app: config, anonymous session, sandbox. */
export function AppGate({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();

  if (status === "unconfigured") {
    return (
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        <NotConfigured />
      </main>
    );
  }
  if (status === "loading") return <FullPageLoading title="Loading" />;
  if (status === "signed-out" || !user) return <SignedOut />;

  return (
    <SandboxProvider key={user.uid} uid={user.uid}>
      <AppShell>{children}</AppShell>
    </SandboxProvider>
  );
}
