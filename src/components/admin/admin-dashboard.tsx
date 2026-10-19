"use client";

import { format, formatDistanceToNow } from "date-fns";
import {
  AlertTriangleIcon,
  BanknoteIcon,
  CalendarCheckIcon,
  FlaskConicalIcon,
  ReceiptIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { HOSPITAL_NAME } from "@/components/brand";
import { ErrorState } from "@/components/app/live-state";
import { PageHeader } from "@/components/app/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { AUDIT_ACTION_LABELS } from "@/lib/hms/audit-log";
import { useCollection } from "@/lib/hms/hooks";
import {
  appointmentsByDepartment,
  appointmentsTodayByStatus,
  dailyRevenue,
  labTestsOrdered,
  latestActivity,
  lowStockCount,
  outstandingBalance,
  patientRegistrations,
  pendingLabOrders,
  revenueThisMonth,
  stockValueByCategory,
} from "@/lib/hms/metrics";
import { formatNaira, formatNairaCompact } from "@/lib/hms/money";
import { ROLE_LABELS } from "@/lib/hms/roles";
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUSES,
} from "@/lib/hms/transitions";
import { ChartFigure, HorizontalBarChart, TimeAreaChart } from "./charts";

function Kpi({
  label,
  value,
  detail,
  icon: Icon,
  href,
  testId,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  icon: typeof UsersIcon;
  href?: string;
  testId?: string;
}) {
  const body = (
    <>
      <dt className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
        {label}
      </dt>
      <dd
        className="mt-2 text-2xl font-semibold tabular-nums"
        data-testid={testId}
      >
        {value}
      </dd>
      {detail && (
        <dd className="mt-1 text-xs text-muted-foreground">{detail}</dd>
      )}
    </>
  );
  return (
    <div className="rounded-xl border bg-card p-4">
      {href ? (
        <Link
          href={href}
          className="block rounded focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <dl>{body}</dl>
        </Link>
      ) : (
        <dl>{body}</dl>
      )}
    </div>
  );
}

const count = (n: number) => n.toLocaleString("en-NG");

export function AdminDashboard({ journey }: { journey: React.ReactNode }) {
  const now = useMemo(() => new Date(), []);
  const patients = useCollection("patients");
  const appointments = useCollection("appointments");
  const invoices = useCollection("invoices");
  const stock = useCollection("stockItems");
  const labOrders = useCollection("labOrders");
  const activity = useCollection("auditLog", {
    orderBy: [["at", "desc"]],
    limit: 10,
  });
  const live = [patients, appointments, invoices, stock, labOrders, activity];
  const failed = live.find((l) => l.error);
  const loading = live.some((l) => l.loading);
  const v = (node: React.ReactNode) =>
    loading ? <Skeleton className="h-8 w-20" /> : node;

  const registrations = patientRegistrations(patients.data ?? [], now);
  const today = appointmentsTodayByStatus(appointments.data ?? [], now);
  const revenue = dailyRevenue(invoices.data ?? [], now);
  const departments = appointmentsByDepartment(appointments.data ?? []);
  const tests = labTestsOrdered(labOrders.data ?? []);
  const stockValue = stockValueByCategory(stock.data ?? []);
  const todayDetail = APPOINTMENT_STATUSES.filter((s) => today.counts[s] > 0)
    .map(
      (s) => `${today.counts[s]} ${APPOINTMENT_STATUS_LABELS[s].toLowerCase()}`,
    )
    .join(" · ");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Admin dashboard"
        description={`${HOSPITAL_NAME} · ${format(now, "EEEE d MMMM yyyy")} · all figures from your fake sandbox`}
      />
      {journey}
      {failed?.error ? (
        <ErrorState
          error={failed.error}
          onRetry={() => live.forEach((l) => l.retry())}
        />
      ) : (
        <>
          <section aria-labelledby="kpi-heading">
            <h2 id="kpi-heading" className="sr-only">
              Key figures
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Kpi
                icon={UsersIcon}
                label="Patients registered"
                value={v(count(registrations.total))}
                detail={`${registrations.last7Days} in the last 7 days`}
                testId="kpi-patients"
              />
              <Kpi
                icon={CalendarCheckIcon}
                label="Appointments today"
                value={v(count(today.total))}
                detail={todayDetail || "None booked"}
                href="/app/appointments"
                testId="kpi-appointments"
              />
              <Kpi
                icon={BanknoteIcon}
                label="Revenue collected this month"
                value={v(
                  formatNaira(revenueThisMonth(invoices.data ?? [], now)),
                )}
                detail="Demo payments only"
                href="/app/billing"
                testId="kpi-revenue"
              />
              <Kpi
                icon={ReceiptIcon}
                label="Outstanding balance"
                value={v(formatNaira(outstandingBalance(invoices.data ?? [])))}
                detail={`${(invoices.data ?? []).filter((i) => i.status !== "paid").length} open invoices`}
                href="/app/billing?status=unpaid"
                testId="kpi-outstanding"
              />
              <Kpi
                icon={AlertTriangleIcon}
                label="Low-stock items"
                value={v(count(lowStockCount(stock.data ?? [])))}
                detail="At or below reorder level"
                href="/app/pharmacy?tab=stock&low=1"
                testId="kpi-low-stock"
              />
              <Kpi
                icon={FlaskConicalIcon}
                label="Lab orders pending"
                value={v(count(pendingLabOrders(labOrders.data ?? [])))}
                detail="Requested or collected"
                href="/app/lab"
                testId="kpi-lab"
              />
            </div>
          </section>

          {!loading && (
            <section aria-labelledby="charts-heading" className="space-y-4">
              <h2 id="charts-heading" className="text-lg font-semibold">
                Trends and breakdowns
              </h2>
              <ChartFigure
                id="chart-revenue"
                title="Daily revenue, last 30 days"
                description="Payments recorded per day, in naira (your local time zone)."
                columns={["Day", "Revenue"]}
                rows={revenue.map((d) => [d.label, formatNaira(d.kobo)])}
              >
                <TimeAreaChart
                  data={revenue.map((d) => ({ label: d.label, value: d.kobo }))}
                  format={formatNaira}
                  compact={formatNairaCompact}
                />
              </ChartFigure>
              <div className="grid gap-4 lg:grid-cols-2">
                <ChartFigure
                  id="chart-departments"
                  title="Appointments by department"
                  description="All booked appointments in the sandbox, excluding cancelled."
                  columns={["Department", "Appointments"]}
                  rows={departments.map((d) => [d.department, count(d.count)])}
                >
                  <HorizontalBarChart
                    data={departments.map((d) => ({
                      label: d.department,
                      value: d.count,
                    }))}
                    format={count}
                  />
                </ChartFigure>
                <ChartFigure
                  id="chart-lab-tests"
                  title="Lab tests ordered"
                  description="How often each test has been requested."
                  columns={["Test", "Orders"]}
                  rows={tests.map((t) => [t.name, count(t.count)])}
                >
                  <HorizontalBarChart
                    data={tests
                      .slice(0, 8)
                      .map((t) => ({ label: t.name, value: t.count }))}
                    format={count}
                  />
                </ChartFigure>
              </div>
              <ChartFigure
                id="chart-stock-value"
                title="Stock value by category"
                description="Quantity on hand × unit price, in naira."
                columns={["Category", "Value"]}
                rows={stockValue.map((s) => [
                  s.category,
                  formatNaira(s.valueKobo),
                ])}
              >
                <HorizontalBarChart
                  data={stockValue.map((s) => ({
                    label: s.category,
                    value: s.valueKobo,
                  }))}
                  format={formatNairaCompact}
                />
              </ChartFigure>
            </section>
          )}

          <section
            aria-labelledby="activity-heading"
            className="rounded-xl border bg-card p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="activity-heading" className="font-semibold">
                Activity
              </h2>
              <Link
                href="/app/audit-log"
                className="text-sm underline underline-offset-4"
              >
                Full audit log
              </Link>
            </div>
            {loading ? (
              <Skeleton className="mt-3 h-24 w-full" />
            ) : (activity.data ?? []).length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No activity yet.
              </p>
            ) : (
              <ol className="mt-3 divide-y" data-testid="activity-feed">
                {latestActivity(activity.data ?? []).map((e) => (
                  <li
                    key={e.id}
                    className="flex flex-wrap justify-between gap-x-3 py-2 text-sm"
                  >
                    <span>
                      {AUDIT_ACTION_LABELS[e.action]}
                      <span className="text-muted-foreground">
                        {" "}
                        · {ROLE_LABELS[e.actorRole]}
                      </span>
                    </span>
                    <time
                      dateTime={e.at.toISOString()}
                      className="text-muted-foreground"
                    >
                      {formatDistanceToNow(e.at, { addSuffix: true })}
                    </time>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </div>
  );
}
