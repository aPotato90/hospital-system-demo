"use client";

import { ArrowRightIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/firebase/auth-provider";

/** Starts an anonymous sandbox and opens the app. */
export function ExploreButton() {
  const { status, signInAsGuest } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (status === "unconfigured") {
    return (
      <div className="space-y-2">
        <Button size="lg" disabled className="h-11 px-5 text-base">
          Explore the demo
        </Button>
        <p className="text-sm text-muted-foreground">
          Firebase is not configured for this deployment. See the README.
        </p>
      </div>
    );
  }

  const signedIn = status === "signed-in";
  async function start() {
    setBusy(true);
    try {
      await signInAsGuest();
      router.push("/app");
    } catch {
      toast.error(
        "Could not start the demo. Check your connection and try again.",
      );
      setBusy(false);
    }
  }

  return (
    <Button
      size="lg"
      className="h-11 px-5 text-base"
      onClick={start}
      disabled={busy}
      aria-busy={busy}
    >
      {busy ? (
        <Loader2Icon className="animate-spin" aria-hidden="true" />
      ) : null}
      {signedIn ? "Continue the demo" : "Explore the demo"}
      {!busy && <ArrowRightIcon aria-hidden="true" />}
    </Button>
  );
}
