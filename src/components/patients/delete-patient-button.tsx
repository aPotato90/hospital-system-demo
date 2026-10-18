"use client";

import { Loader2Icon, Trash2Icon } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import {
  deletePatient,
  loadPatientRecords,
  restorePatient,
} from "@/lib/hms/actions";
import {
  describeCascade,
  planPatientDeletion,
  type PatientDeletionPlan,
} from "@/lib/hms/cascade";
import type { Patient } from "@/lib/hms/patient";
import { useSandbox } from "@/lib/hms/sandbox-context";

const UNDO_MS = 10_000;

/**
 * Safe delete: plan the cascade first, show exactly what goes, refuse while a
 * visit is in progress, and offer Undo afterwards.
 */
export function DeletePatientButton({ patient }: { patient: Patient }) {
  const sandbox = useSandbox();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<PatientDeletionPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const name = `${patient.firstName} ${patient.lastName}`;

  async function prepare() {
    setBusy(true);
    try {
      const records = await loadPatientRecords(sandbox, patient.id);
      setPlan(planPatientDeletion(patient, records));
      setOpen(true);
    } catch {
      toast.error("Could not check this patient's records. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(event: React.MouseEvent) {
    event.preventDefault();
    if (!plan || plan.blockedReason) return;
    setBusy(true);
    try {
      await deletePatient(sandbox, plan);
    } catch {
      toast.error("Could not delete the patient. Nothing was changed.");
      setBusy(false);
      return;
    }
    setOpen(false);
    router.push("/app/patients");
    const deleted = plan;
    toast(`${name} deleted`, {
      description: `Also removed ${describeCascade(deleted.counts)}.`,
      duration: UNDO_MS,
      action: {
        label: "Undo",
        onClick: async () => {
          try {
            await restorePatient(sandbox, deleted);
            toast.success(`${name} restored`, {
              action: {
                label: "Open",
                onClick: () =>
                  router.push(`/app/patients/${deleted.patientId}`),
              },
            });
          } catch {
            toast.error("Could not restore the patient.");
          }
        },
      },
    });
  }

  const blocked = plan?.blockedReason;

  return (
    <>
      <Button variant="destructive" onClick={prepare} disabled={busy}>
        {busy && !open ? (
          <Loader2Icon className="animate-spin" aria-hidden="true" />
        ) : (
          <Trash2Icon aria-hidden="true" />
        )}
        Delete
      </Button>
      <AlertDialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {blocked ? `${name} cannot be deleted yet` : `Delete ${name}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {blocked
                ? blocked
                : plan &&
                  `This removes the patient and ${describeCascade(plan.counts)} from your sandbox. You can undo for a few seconds afterwards.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>
              {blocked ? "Close" : "Cancel"}
            </AlertDialogCancel>
            {!blocked && (
              <AlertDialogAction
                variant="destructive"
                onClick={confirm}
                disabled={busy}
              >
                {busy && (
                  <Loader2Icon className="animate-spin" aria-hidden="true" />
                )}
                Delete patient
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
