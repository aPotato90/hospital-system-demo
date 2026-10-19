import { cn } from "@/lib/utils";
import {
  APPOINTMENT_STATUS_LABELS,
  INVOICE_STATUS_LABELS,
  LAB_ORDER_STATUS_LABELS,
  PRESCRIPTION_STATUS_LABELS,
  type AppointmentStatus,
  type InvoiceStatus,
  type LabOrderStatus,
  type PrescriptionStatus,
} from "@/lib/hms/transitions";

const STYLES: Record<string, string> = {
  scheduled: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  "checked-in":
    "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  "in-consultation":
    "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
  completed:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  cancelled: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
  "no-show": "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
  unpaid: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
  "part-paid":
    "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  paid: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  requested: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  collected:
    "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  resulted:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  pending: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  dispensed:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
};

const LABELS: Record<string, string> = {
  ...APPOINTMENT_STATUS_LABELS,
  ...INVOICE_STATUS_LABELS,
  ...LAB_ORDER_STATUS_LABELS,
  ...PRESCRIPTION_STATUS_LABELS,
};

export type BadgeStatus =
  AppointmentStatus | InvoiceStatus | LabOrderStatus | PrescriptionStatus;

/** Colour-coded status pill; the text always carries the meaning. */
export function StatusBadge({
  status,
  className,
}: {
  status: BadgeStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
        STYLES[status],
        className,
      )}
    >
      {LABELS[status]}
    </span>
  );
}
