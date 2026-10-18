import { cn } from "@/lib/utils";
import {
  APPOINTMENT_STATUS_LABELS,
  type AppointmentStatus,
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
};

const LABELS: Record<string, string> = {
  ...APPOINTMENT_STATUS_LABELS,
  unpaid: "Unpaid",
  "part-paid": "Part-paid",
  paid: "Paid",
};

/** Colour-coded status pill; the text always carries the meaning. */
export function StatusBadge({
  status,
  className,
}: {
  status: AppointmentStatus | "unpaid" | "part-paid" | "paid";
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
