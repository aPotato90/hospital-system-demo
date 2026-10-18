"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSandbox } from "@/lib/hms/sandbox-context";

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

export function ResetDemoDialog({ open, onOpenChange }: Props) {
  const { resetDemo } = useSandbox();
  const router = useRouter();

  async function reset() {
    onOpenChange(false);
    router.push("/app");
    try {
      await resetDemo();
      toast.success("Demo data reset");
    } catch {
      toast.error("Could not reset the demo data. Try again.");
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset demo data?</AlertDialogTitle>
          <AlertDialogDescription>
            Every patient, appointment and record in your sandbox is deleted and
            a fresh set of fake data is created. The audit trail keeps its
            entries.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={reset}>
            Reset data
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function SignOutDialog({ open, onOpenChange }: Props) {
  const { signOut: signOutAndDelete } = useSandbox();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut(event: React.MouseEvent) {
    event.preventDefault();
    setBusy(true);
    const deleted = await signOutAndDelete();
    router.replace("/");
    if (deleted) toast.success("Signed out. Your demo sandbox was deleted.");
    else toast.warning("Signed out. Some sandbox data could not be deleted.");
  }

  return (
    <AlertDialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sign out and delete your sandbox?</AlertDialogTitle>
          <AlertDialogDescription>
            Your demo data is deleted and this anonymous session ends. You can
            start a fresh demo from the home page at any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={signOut}
            disabled={busy}
          >
            {busy && (
              <Loader2Icon className="animate-spin" aria-hidden="true" />
            )}
            Sign out
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
