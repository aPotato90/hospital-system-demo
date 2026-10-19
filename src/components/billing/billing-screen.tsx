"use client";

import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/appointments/status-badge";
import { ErrorState, ListSkeleton } from "@/components/app/live-state";
import { PageHeader } from "@/components/app/page-header";
import { RoleGate } from "@/components/app/role-gate";
import { Input } from "@/components/ui/input";
import { useUrlUpdate } from "@/hooks/use-url-update";
import { formatDate } from "@/lib/format";
import {
  filterInvoices,
  invoiceTotals,
  type InvoiceFilter,
} from "@/lib/hms/billing";
import { useById, useCollection } from "@/lib/hms/hooks";
import { invoiceBalanceKobo } from "@/lib/hms/invoice";
import { formatNaira } from "@/lib/hms/money";
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUSES,
  type InvoiceStatus,
} from "@/lib/hms/transitions";
import { cn } from "@/lib/utils";

function parseFilter(params: URLSearchParams): InvoiceFilter {
  const status = params.get("status");
  return {
    status: (INVOICE_STATUSES as readonly string[]).includes(status ?? "")
      ? (status as InvoiceStatus)
      : null,
    q: (params.get("q") ?? "").slice(0, 100),
  };
}

function search(f: InvoiceFilter) {
  const out = new URLSearchParams();
  if (f.status) out.set("status", f.status);
  if (f.q) out.set("q", f.q);
  const s = out.toString();
  return s ? `?${s}` : "";
}

export function BillingScreen() {
  const searchParams = useSearchParams();
  const filter = parseFilter(new URLSearchParams(searchParams.toString()));
  const updateUrl = useUrlUpdate();
  const invoices = useCollection("invoices");
  const patients = useCollection("patients");
  const patientById = useById(patients.data);
  const [text, setText] = useState(filter.q);
  const go = (next: Partial<InvoiceFilter>) =>
    updateUrl(search({ ...filter, ...next }));

  const label = (id: string) => {
    const p = patientById.get(id);
    return p ? `${p.firstName} ${p.lastName} ${p.patientNo}` : "";
  };
  const rows = useMemo(
    () => filterInvoices(invoices.data ?? [], label, filter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [invoices.data, patientById, filter.status, filter.q],
  );
  const totals = invoiceTotals(rows);
  const failed = invoices.error ?? patients.error;

  return (
    <RoleGate>
      <PageHeader
        title="Billing"
        description="Invoices in naira. Payments are recorded for the demo only; no money moves."
      />

      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-end">
        <div className="relative flex-1">
          <label
            htmlFor="billing-search"
            className="mb-1.5 block text-sm font-medium"
          >
            Search patient
          </label>
          <SearchIcon
            className="pointer-events-none absolute bottom-2 left-2.5 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="billing-search"
            type="search"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              go({ q: e.target.value.trimStart() });
            }}
            placeholder="Name or patient number"
            className="h-9 pl-8"
            autoComplete="off"
            maxLength={100}
          />
        </div>
        <div
          role="group"
          aria-label="Status"
          className="inline-flex flex-wrap rounded-lg bg-muted p-0.5"
        >
          {([null, ...INVOICE_STATUSES] as const).map((s) => (
            <button
              key={s ?? "all"}
              type="button"
              aria-pressed={filter.status === s}
              onClick={() => go({ status: s })}
              className={cn(
                "h-8 rounded-md px-3 text-sm font-medium focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                filter.status === s
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s ? INVOICE_STATUS_LABELS[s] : "All"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {failed ? (
          <ErrorState
            error={failed}
            onRetry={() => {
              invoices.retry();
              patients.retry();
            }}
          />
        ) : invoices.loading || patients.loading ? (
          <ListSkeleton />
        ) : (
          <>
            <dl className="mb-4 grid grid-cols-3 gap-2 rounded-xl border bg-card p-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Invoiced</dt>
                <dd className="font-semibold tabular-nums">
                  {formatNaira(totals.totalKobo)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Paid</dt>
                <dd className="font-semibold tabular-nums">
                  {formatNaira(totals.paidKobo)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Outstanding</dt>
                <dd
                  className="font-semibold tabular-nums"
                  data-testid="billing-outstanding"
                >
                  {formatNaira(totals.balanceKobo)}
                </dd>
              </div>
            </dl>
            {rows.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                No invoices match.
              </p>
            ) : (
              <>
                <p
                  className="mb-2 text-sm text-muted-foreground"
                  aria-live="polite"
                >
                  {rows.length} invoices
                </p>
                <ul className="space-y-2 md:hidden" aria-label="Invoices">
                  {rows.map((i) => {
                    const p = patientById.get(i.patientId);
                    return (
                      <li key={i.id}>
                        <Link
                          href={`/app/billing/${i.id}`}
                          className="block rounded-xl border bg-card p-3 hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="font-medium">
                              {p
                                ? `${p.firstName} ${p.lastName}`
                                : "Unknown patient"}
                            </span>
                            <StatusBadge status={i.status} />
                          </span>
                          <span className="mt-1 block text-sm text-muted-foreground">
                            {formatDate(i.createdAt)} · Total{" "}
                            {formatNaira(i.totalKobo)} · Balance{" "}
                            {formatNaira(invoiceBalanceKobo(i))}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
                  <table className="w-full text-sm">
                    <caption className="sr-only">
                      Invoices, newest first
                    </caption>
                    <thead className="border-b bg-muted/50 text-left text-muted-foreground">
                      <tr>
                        <th scope="col" className="px-3 py-2 font-medium">
                          Date
                        </th>
                        <th scope="col" className="px-3 py-2 font-medium">
                          Patient
                        </th>
                        <th scope="col" className="px-3 py-2 font-medium">
                          Status
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-2 text-right font-medium"
                        >
                          Total
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-2 text-right font-medium"
                        >
                          Paid
                        </th>
                        <th
                          scope="col"
                          className="px-3 py-2 text-right font-medium"
                        >
                          Balance
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((i) => {
                        const p = patientById.get(i.patientId);
                        return (
                          <tr
                            key={i.id}
                            className="border-b last:border-0 hover:bg-muted/40"
                          >
                            <td className="px-3 py-2 whitespace-nowrap">
                              <Link
                                href={`/app/billing/${i.id}`}
                                className="font-medium underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                              >
                                {formatDate(i.createdAt)}
                                <span className="sr-only">
                                  {" "}
                                  invoice for{" "}
                                  {p
                                    ? `${p.firstName} ${p.lastName}`
                                    : "patient"}
                                </span>
                              </Link>
                            </td>
                            <td className="px-3 py-2">
                              {p
                                ? `${p.firstName} ${p.lastName}`
                                : "Unknown patient"}
                              {p && (
                                <span className="ml-2 font-mono text-xs text-muted-foreground">
                                  {p.patientNo}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <StatusBadge status={i.status} />
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatNaira(i.totalKobo)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatNaira(i.paidKobo)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatNaira(invoiceBalanceKobo(i))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </RoleGate>
  );
}
