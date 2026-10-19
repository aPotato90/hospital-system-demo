"use client";

import { AlertTriangleIcon, Loader2Icon, PackageCheckIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ErrorState, ListSkeleton } from "@/components/app/live-state";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { dispensePrescription } from "@/lib/hms/clinical-actions";
import { allergyMentionsDrug, planDispense } from "@/lib/hms/dispense";
import { useById, useCollection } from "@/lib/hms/hooks";
import type { Prescription } from "@/lib/hms/prescription";
import { useSandbox } from "@/lib/hms/sandbox-context";

export function DispenseQueue() {
  const sandbox = useSandbox();
  const pending = useCollection("prescriptions", {
    where: [["status", "==", "pending"]],
  });
  const stock = useCollection("stockItems");
  const patients = useCollection("patients");
  const consultations = useCollection("consultations");
  const stockById = useById(stock.data);
  const patientById = useById(patients.data);
  const consultationById = useById(consultations.data);
  const [busyId, setBusyId] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      [...(pending.data ?? [])].sort(
        (a, b) =>
          (consultationById.get(a.consultationId)?.createdAt.getTime() ?? 0) -
          (consultationById.get(b.consultationId)?.createdAt.getTime() ?? 0),
      ),
    [pending.data, consultationById],
  );

  async function dispense(rx: Prescription) {
    setBusyId(rx.id);
    try {
      await dispensePrescription(sandbox, rx, stockById.get(rx.stockItemId));
      const p = patientById.get(rx.patientId);
      toast.success(
        `Dispensed ${rx.quantity} × ${rx.name}${p ? ` for ${p.firstName} ${p.lastName}` : ""}`,
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not dispense. Try again.",
      );
    } finally {
      setBusyId(null);
    }
  }

  const failed =
    pending.error ?? stock.error ?? patients.error ?? consultations.error;
  if (failed) {
    return (
      <ErrorState
        error={failed}
        onRetry={() =>
          [pending, stock, patients, consultations].forEach((l) => l.retry())
        }
      />
    );
  }
  if (
    pending.loading ||
    stock.loading ||
    patients.loading ||
    consultations.loading
  ) {
    return <ListSkeleton rows={4} />;
  }
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Nothing waiting to be dispensed.
      </p>
    );
  }

  return (
    <ul
      className="space-y-2"
      aria-label="Prescriptions waiting to be dispensed"
    >
      {rows.map((rx) => {
        const p = patientById.get(rx.patientId);
        const item = stockById.get(rx.stockItemId);
        const plan = planDispense(rx, item);
        const flagged = p ? allergyMentionsDrug(p.allergies, rx.name) : false;
        const prescribedAt = consultationById.get(rx.consultationId)?.createdAt;
        const name = p ? `${p.firstName} ${p.lastName}` : "Unknown patient";
        return (
          <li
            key={rx.id}
            data-testid="dispense-row"
            className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-start"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-medium">
                {rx.name} × {rx.quantity}
              </p>
              <p className="text-sm text-muted-foreground">
                {name}
                {p && (
                  <span className="ml-2 font-mono text-xs">{p.patientNo}</span>
                )}
                {prescribedAt &&
                  ` · Prescribed ${formatDateTime(prescribedAt)}`}
              </p>
              <p className="text-sm">
                On hand:{" "}
                <span className="font-medium tabular-nums">
                  {item
                    ? `${item.quantity} ${item.unit}(s)`
                    : "not in stock records"}
                </span>
              </p>
              {flagged && (
                <p
                  className="flex items-start gap-2 rounded-md bg-rose-50 px-2 py-1 text-sm text-rose-900 dark:bg-rose-950 dark:text-rose-100"
                  data-testid="allergy-flag"
                >
                  <AlertTriangleIcon
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    Allergy note mentions this drug: &ldquo;{p!.allergies}
                    &rdquo;. Demo helper (simple text match), not a safety
                    check.
                  </span>
                </p>
              )}
              {!plan.ok && (
                <p
                  className="flex items-start gap-2 text-sm text-destructive"
                  role="status"
                >
                  <AlertTriangleIcon
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    {plan.reason}{" "}
                    {item && (
                      <Link
                        href={`/app/pharmacy?tab=stock&q=${encodeURIComponent(item.name)}`}
                        className="underline underline-offset-2"
                      >
                        Open in stock
                      </Link>
                    )}
                  </span>
                </p>
              )}
            </div>
            <Button
              size="sm"
              onClick={() => dispense(rx)}
              disabled={!plan.ok || busyId !== null}
              aria-label={`Dispense ${rx.name} for ${name}`}
            >
              {busyId === rx.id ? (
                <Loader2Icon className="animate-spin" aria-hidden="true" />
              ) : (
                <PackageCheckIcon aria-hidden="true" />
              )}
              Dispense
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
