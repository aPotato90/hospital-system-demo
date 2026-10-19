import type { Consultation } from "./consultation";
import type { LabOrder } from "./lab-order";
import type { Patient } from "./patient";
import { localIsoDate } from "./common";
import type { LabOrderStatus } from "./transitions";

export type LabFilter = {
  status: LabOrderStatus;
  testId: string | null;
  /** YYYY-MM-DD (local) the test was ordered, or null for any day. */
  date: string | null;
  q: string;
};

/** When an order was placed: its consultation's time. */
export function orderedAt(
  order: Pick<LabOrder, "consultationId">,
  consultations: ReadonlyMap<string, Pick<Consultation, "createdAt">>,
): Date | null {
  return consultations.get(order.consultationId)?.createdAt ?? null;
}

/**
 * The lab worklist: orders in one status, optionally for one test, one order
 * day (local time) and a patient name or number search. Oldest first, so the
 * longest-waiting sample is at the top.
 */
export function filterLabOrders(
  orders: readonly LabOrder[],
  filter: LabFilter,
  patients: ReadonlyMap<
    string,
    Pick<Patient, "firstName" | "lastName" | "patientNo">
  >,
  consultations: ReadonlyMap<string, Pick<Consultation, "createdAt">>,
): LabOrder[] {
  const q = filter.q.trim().toLowerCase();
  return orders
    .filter((o) => o.status === filter.status)
    .filter((o) => !filter.testId || o.testId === filter.testId)
    .filter((o) => {
      if (!filter.date) return true;
      const at = orderedAt(o, consultations);
      return at !== null && localIsoDate(at) === filter.date;
    })
    .filter((o) => {
      if (!q) return true;
      const p = patients.get(o.patientId);
      return p
        ? `${p.firstName} ${p.lastName} ${p.patientNo}`
            .toLowerCase()
            .includes(q)
        : false;
    })
    .sort(
      (a, b) =>
        (orderedAt(a, consultations)?.getTime() ?? 0) -
        (orderedAt(b, consultations)?.getTime() ?? 0),
    );
}

export function countLabOrdersByStatus(orders: readonly LabOrder[]) {
  return {
    requested: orders.filter((o) => o.status === "requested").length,
    collected: orders.filter((o) => o.status === "collected").length,
    resulted: orders.filter((o) => o.status === "resulted").length,
  } satisfies Record<LabOrderStatus, number>;
}
