import {
  addDays,
  addMonths,
  format,
  startOfDay,
  startOfMonth,
  subDays,
} from "date-fns";
import type { Appointment } from "./appointment";
import type { AuditLogEntry } from "./audit-log";
import { CLINICAL_DEPARTMENTS, type ClinicalDepartment } from "./common";
import { invoiceBalanceKobo, type Invoice } from "./invoice";
import type { LabOrder } from "./lab-order";
import type { Patient } from "./patient";
import { isLowStock, stockValueKobo, type StockItem } from "./stock-item";
import { APPOINTMENT_STATUSES, type AppointmentStatus } from "./transitions";

/**
 * Admin dashboard calculations. All pure: they take the sandbox data and an
 * explicit `now`, and count days and months in the browser's local time zone
 * (so "today" in Lagos starts at 00:00 Lagos time, not UTC).
 */

const inRange = (d: Date, start: Date, end: Date) => d >= start && d < end;

/** Patients registered in total and in the last 7 local days (today included). */
export function patientRegistrations(
  patients: readonly Pick<Patient, "registeredAt">[],
  now: Date,
) {
  const since = subDays(startOfDay(now), 6);
  return {
    total: patients.length,
    last7Days: patients.filter(
      (p) => p.registeredAt >= since && p.registeredAt <= now,
    ).length,
  };
}

/** Today's appointments by status, plus the total. */
export function appointmentsTodayByStatus(
  appointments: readonly Pick<Appointment, "scheduledAt" | "status">[],
  now: Date,
) {
  const start = startOfDay(now);
  const end = addDays(start, 1);
  const counts = Object.fromEntries(
    APPOINTMENT_STATUSES.map((s) => [s, 0]),
  ) as Record<AppointmentStatus, number>;
  let total = 0;
  for (const a of appointments) {
    if (!inRange(a.scheduledAt, start, end)) continue;
    counts[a.status] += 1;
    total += 1;
  }
  return { counts, total };
}

/** Payments received in the current local calendar month, in kobo. */
export function revenueThisMonth(
  invoices: readonly Pick<Invoice, "payments">[],
  now: Date,
) {
  const start = startOfMonth(now);
  const end = addMonths(start, 1);
  return invoices.reduce(
    (sum, i) =>
      sum +
      i.payments
        .filter((p) => inRange(p.at, start, end))
        .reduce((s, p) => s + p.amountKobo, 0),
    0,
  );
}

/** What patients still owe across all invoices, in kobo. */
export function outstandingBalance(
  invoices: readonly Pick<Invoice, "totalKobo" | "paidKobo">[],
) {
  return invoices.reduce((sum, i) => sum + invoiceBalanceKobo(i), 0);
}

export function lowStockCount(
  stock: readonly Pick<StockItem, "quantity" | "reorderLevel">[],
) {
  return stock.filter(isLowStock).length;
}

/** Lab orders not yet resulted (requested or collected). */
export function pendingLabOrders(orders: readonly Pick<LabOrder, "status">[]) {
  return orders.filter((o) => o.status !== "resulted").length;
}

export type DailyRevenue = { date: string; label: string; kobo: number };

/** Revenue per local day for the last `days` days, oldest first, today last. */
export function dailyRevenue(
  invoices: readonly Pick<Invoice, "payments">[],
  now: Date,
  days = 30,
): DailyRevenue[] {
  const first = subDays(startOfDay(now), days - 1);
  const buckets = Array.from({ length: days }, (_, i) => {
    const day = addDays(first, i);
    return {
      date: format(day, "yyyy-MM-dd"),
      label: format(day, "d MMM"),
      kobo: 0,
    };
  });
  const index = new Map(buckets.map((b, i) => [b.date, i]));
  for (const invoice of invoices) {
    for (const p of invoice.payments) {
      const i = index.get(format(p.at, "yyyy-MM-dd"));
      if (i !== undefined && p.at <= now) buckets[i].kobo += p.amountKobo;
    }
  }
  return buckets;
}

/** Appointments per clinical department, excluding cancelled ones. */
export function appointmentsByDepartment(
  appointments: readonly Pick<Appointment, "department" | "status">[],
): { department: ClinicalDepartment; count: number }[] {
  return CLINICAL_DEPARTMENTS.map((department) => ({
    department,
    count: appointments.filter(
      (a) => a.department === department && a.status !== "cancelled",
    ).length,
  }));
}

/** How many times each lab test has been ordered, most ordered first. */
export function labTestsOrdered(orders: readonly Pick<LabOrder, "name">[]) {
  const counts = new Map<string, number>();
  for (const o of orders) counts.set(o.name, (counts.get(o.name) ?? 0) + 1);
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Value of stock on hand (quantity x unit price) per category, largest first. */
export function stockValueByCategory(
  stock: readonly Pick<StockItem, "category" | "quantity" | "unitPriceKobo">[],
) {
  const values = new Map<string, number>();
  for (const s of stock)
    values.set(s.category, (values.get(s.category) ?? 0) + stockValueKobo(s));
  return [...values]
    .map(([category, valueKobo]) => ({ category, valueKobo }))
    .sort(
      (a, b) =>
        b.valueKobo - a.valueKobo || a.category.localeCompare(b.category),
    );
}

/** The newest audit entries first. */
export function latestActivity<T extends Pick<AuditLogEntry, "at">>(
  entries: readonly T[],
  n = 10,
) {
  return [...entries]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, n);
}
