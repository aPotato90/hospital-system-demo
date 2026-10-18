"use client";

import { addDays, format, startOfDay } from "date-fns";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  BanknoteIcon,
  CalendarCheckIcon,
  UserCheckIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { HOSPITAL_NAME } from "@/components/brand";
import { useCollection } from "@/lib/hms/hooks";
import { invoiceBalanceKobo } from "@/lib/hms/invoice";
import { formatNaira } from "@/lib/hms/money";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/hms/roles";
import { useSandbox } from "@/lib/hms/sandbox-context";
import { isLowStock } from "@/lib/hms/stock-item";
import { ErrorState } from "@/components/app/live-state";
import { navItemsFor } from "@/components/app/nav-config";
import { PageHeader } from "@/components/app/page-header";
import { Skeleton } from "@/components/ui/skeleton";

function Stat({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon: typeof UsersIcon;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <dt className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-2 text-2xl font-semibold tabular-nums">{value}</dd>
      {hint && <dd className="mt-1 text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}

export function Overview() {
  const { role } = useSandbox();
  const today = useMemo(() => startOfDay(new Date()), []);
  const patients = useCollection("patients");
  const appointments = useCollection("appointments", {
    where: [
      ["scheduledAt", ">=", today],
      ["scheduledAt", "<", addDays(today, 1)],
    ],
  });
  const invoices = useCollection("invoices");
  const stock = useCollection("stockItems");

  const live = [patients, appointments, invoices, stock];
  const failed = live.find((l) => l.error);
  const loading = live.some((l) => l.loading);

  const todays = appointments.data ?? [];
  const waiting = todays.filter((a) => a.status === "checked-in").length;
  const open = (invoices.data ?? []).filter((i) => i.status !== "paid");
  const outstanding = open.reduce((sum, i) => sum + invoiceBalanceKobo(i), 0);
  const low = (stock.data ?? []).filter(isLowStock).length;

  const v = (value: React.ReactNode) =>
    loading ? <Skeleton className="h-8 w-16" /> : value;

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Good day, ${ROLE_LABELS[role]}`}
        description={`${HOSPITAL_NAME} · ${format(new Date(), "EEEE d MMMM yyyy")}`}
      />

      {failed?.error ? (
        <ErrorState error={failed.error} onRetry={failed.retry} />
      ) : (
        <section aria-labelledby="today-heading">
          <h2 id="today-heading" className="sr-only">
            Today at a glance
          </h2>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              icon={UsersIcon}
              label="Registered patients"
              value={v(patients.data?.length)}
            />
            <Stat
              icon={CalendarCheckIcon}
              label="Appointments today"
              value={v(todays.length)}
              hint={`${todays.filter((a) => a.status === "scheduled").length} still to arrive`}
            />
            <Stat
              icon={UserCheckIcon}
              label="Checked in, waiting"
              value={v(waiting)}
            />
            <Stat
              icon={BanknoteIcon}
              label="Outstanding balance"
              value={v(formatNaira(outstanding))}
              hint={`${open.length} open invoices`}
            />
          </dl>
          {!loading && low > 0 && (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangleIcon className="size-4" aria-hidden="true" />
              {low} stock items are at or below their reorder level.
            </p>
          )}
        </section>
      )}

      <section
        aria-labelledby="role-heading"
        className="grid gap-4 lg:grid-cols-3"
      >
        <div className="rounded-xl border bg-card p-5 lg:col-span-1">
          <h2 id="role-heading" className="font-semibold">
            Your demo role: {ROLE_LABELS[role]}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {ROLE_DESCRIPTIONS[role]} Use the switcher at the top to see the
            hospital through another role&apos;s eyes. Role switching is a UI
            demonstration only.
          </p>
        </div>
        <nav
          aria-label="Your screens"
          className="rounded-xl border bg-card p-5 lg:col-span-2"
        >
          <h2 className="font-semibold">Your screens</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {navItemsFor(role)
              .slice(1)
              .map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm font-medium hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <span className="flex items-center gap-2">
                      <Icon
                        className="size-4 text-primary"
                        aria-hidden="true"
                      />
                      {label}
                    </span>
                    <ArrowRightIcon className="size-4" aria-hidden="true" />
                  </Link>
                </li>
              ))}
          </ul>
        </nav>
      </section>
    </div>
  );
}
