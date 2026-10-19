import { StatusBadge } from "@/components/appointments/status-badge";
import { formatDateTime } from "@/lib/format";
import type { LabOrder } from "@/lib/hms/lab-order";

/** Lab orders with their status and, once resulted, the (fake) result. */
export function LabResultsList({
  orders,
  empty = "No lab tests requested.",
}: {
  orders: LabOrder[];
  empty?: string;
}) {
  if (orders.length === 0)
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y">
      {orders.map((o) => (
        <li key={o.id} className="py-3 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">{o.name}</p>
            <StatusBadge status={o.status} />
          </div>
          {o.status === "resulted" ? (
            <>
              <p className="mt-1 text-sm whitespace-pre-line">{o.resultText}</p>
              {o.resultedAt && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Resulted {formatDateTime(o.resultedAt)}
                </p>
              )}
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              {o.status === "collected"
                ? "Sample collected, awaiting result."
                : "Awaiting sample."}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
