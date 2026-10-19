"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeftIcon,
  BanknoteIcon,
  Loader2Icon,
  PrinterIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { StatusBadge } from "@/components/appointments/status-badge";
import { HOSPITAL_NAME, PRODUCT_NAME } from "@/components/brand";
import { DEMO_WARNING } from "@/components/demo-banner";
import { ErrorState, ListSkeleton } from "@/components/app/live-state";
import { RoleGate } from "@/components/app/role-gate";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  groupLinesByKind,
  makePaymentFormSchema,
  type PaymentFormValues,
} from "@/lib/hms/billing";
import { recordPayment } from "@/lib/hms/clinical-actions";
import { LIMITS } from "@/lib/hms/common";
import { useDocument } from "@/lib/hms/hooks";
import {
  invoiceBalanceKobo,
  PAYMENT_METHODS,
  type Invoice,
} from "@/lib/hms/invoice";
import { formatNaira } from "@/lib/hms/money";
import { useSandbox } from "@/lib/hms/sandbox-context";

const METHOD_LABELS: Record<(typeof PAYMENT_METHODS)[number], string> = {
  cash: "Cash",
  card: "Card",
  transfer: "Bank transfer",
};

function PaymentDialog({
  invoice,
  open,
  onOpenChange,
}: {
  invoice: Invoice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const sandbox = useSandbox();
  const balance = invoiceBalanceKobo(invoice);
  const schema = useMemo(() => makePaymentFormSchema(balance), [balance]);
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amountNaira: balance / 100, method: "cash" },
    mode: "onTouched",
  });
  const errors = form.formState.errors;

  async function onSubmit(values: PaymentFormValues) {
    setSubmitting(true);
    try {
      const next = await recordPayment(sandbox, invoice, values);
      toast.success(
        `Payment of ${formatNaira(Math.round(values.amountNaira * 100))} recorded. Invoice is ${next.status === "paid" ? "paid" : "part-paid"}.`,
      );
      onOpenChange(false);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not record the payment.",
      );
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="grid gap-4"
        >
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>
              Balance {formatNaira(balance)}. Demo only: no real payment is
              taken.
            </DialogDescription>
          </DialogHeader>
          <Field data-invalid={!!errors.amountNaira}>
            <FieldLabel htmlFor="payment-amount">Amount (₦)</FieldLabel>
            <Input
              id="payment-amount"
              type="number"
              inputMode="decimal"
              min={0.01}
              step={0.01}
              max={balance / 100}
              aria-invalid={!!errors.amountNaira}
              {...form.register("amountNaira", { valueAsNumber: true })}
            />
            <FieldError errors={[errors.amountNaira]} />
          </Field>
          <FieldSet>
            <FieldLegend variant="label">Method</FieldLegend>
            <Controller
              control={form.control}
              name="method"
              render={({ field }) => (
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="flex flex-wrap gap-4"
                  aria-label="Payment method"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <label key={m} className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value={m} id={`payment-${m}`} />
                      {METHOD_LABELS[m]}
                    </label>
                  ))}
                </RadioGroup>
              )}
            />
          </FieldSet>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && (
                <Loader2Icon className="animate-spin" aria-hidden="true" />
              )}
              Record payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function InvoiceDetail() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const invoice = useDocument("invoices", invoiceId);
  const patient = useDocument(
    "patients",
    invoice.data?.patientId ?? "__none__",
  );
  const [paying, setPaying] = useState(false);

  const back = (
    <Link
      href="/app/billing"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground print:hidden"
    >
      <ArrowLeftIcon className="size-4" aria-hidden="true" />
      All invoices
    </Link>
  );
  const failed = invoice.error ?? patient.error;
  if (failed) {
    return (
      <RoleGate>
        {back}
        <h1 className="sr-only">Invoice</h1>
        <div className="mt-4">
          <ErrorState
            error={failed}
            onRetry={() => {
              invoice.retry();
              patient.retry();
            }}
          />
        </div>
      </RoleGate>
    );
  }
  if (invoice.loading || patient.loading) return <ListSkeleton />;
  const i = invoice.data;
  if (!i) {
    return (
      <RoleGate>
        {back}
        <div className="mt-6 rounded-xl border p-6">
          <h1 className="text-lg font-semibold">Invoice not found</h1>
        </div>
      </RoleGate>
    );
  }
  const p = patient.data;
  const balance = invoiceBalanceKobo(i);
  const canPay = balance > 0 && i.payments.length < LIMITS.payments;

  return (
    <RoleGate>
      {back}
      <article className="receipt mt-3 rounded-xl border bg-card p-5 print:mt-0 print:border-0 print:p-0">
        <header className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {HOSPITAL_NAME} · {PRODUCT_NAME}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              Invoice for {p ? `${p.firstName} ${p.lastName}` : "patient"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {p && <span className="font-mono">{p.patientNo}</span>} · Issued{" "}
              {formatDate(i.createdAt)} · Ref{" "}
              <span className="font-mono">{i.id.slice(0, 8)}</span>
            </p>
          </div>
          <StatusBadge status={i.status} />
        </header>

        <p className="mt-4 rounded-md bg-banner px-3 py-2 text-sm text-banner-foreground">
          {DEMO_WARNING} This is not a real receipt or invoice.
        </p>

        {groupLinesByKind(i.lines).map((group) => (
          <section
            key={group.kind}
            aria-labelledby={`lines-${group.kind}`}
            className="mt-5"
          >
            <h2 id={`lines-${group.kind}`} className="text-sm font-semibold">
              {group.label}
            </h2>
            <table className="mt-2 w-full text-sm">
              <thead className="sr-only">
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Quantity and unit price</th>
                  <th scope="col">Amount</th>
                </tr>
              </thead>
              <tbody>
                {group.lines.map((l, n) => (
                  <tr key={n} className="border-b border-dashed last:border-0">
                    <td className="py-1.5 pr-2">{l.description}</td>
                    <td className="py-1.5 pr-2 text-right whitespace-nowrap text-muted-foreground tabular-nums">
                      {l.quantity} × {formatNaira(l.unitPriceKobo)}
                    </td>
                    <td className="py-1.5 text-right whitespace-nowrap tabular-nums">
                      {formatNaira(l.quantity * l.unitPriceKobo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-right text-sm text-muted-foreground">
              Subtotal {formatNaira(group.subtotalKobo)}
            </p>
          </section>
        ))}

        <dl className="mt-5 ml-auto grid max-w-xs grid-cols-2 gap-1 border-t pt-3 text-sm">
          <dt>Total</dt>
          <dd className="text-right font-semibold tabular-nums">
            {formatNaira(i.totalKobo)}
          </dd>
          <dt>Paid</dt>
          <dd className="text-right tabular-nums">{formatNaira(i.paidKobo)}</dd>
          <dt>Balance</dt>
          <dd
            className="text-right font-semibold tabular-nums"
            data-testid="invoice-balance"
          >
            {formatNaira(balance)}
          </dd>
        </dl>

        <section aria-labelledby="payments-heading" className="mt-6">
          <h2 id="payments-heading" className="text-sm font-semibold">
            Payment history
          </h2>
          {i.payments.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No payments yet.
            </p>
          ) : (
            <ul className="mt-2 divide-y text-sm">
              {i.payments.map((pay, n) => (
                <li
                  key={n}
                  className="flex flex-wrap justify-between gap-2 py-1.5"
                >
                  <span>
                    {formatDateTime(pay.at)} · {METHOD_LABELS[pay.method]}
                  </span>
                  <span className="tabular-nums">
                    {formatNaira(pay.amountKobo)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </article>

      <div className="mt-4 flex flex-wrap gap-2 print:hidden">
        {canPay && (
          <Button onClick={() => setPaying(true)}>
            <BanknoteIcon aria-hidden="true" />
            Record payment
          </Button>
        )}
        <Button variant="outline" onClick={() => window.print()}>
          <PrinterIcon aria-hidden="true" />
          Print receipt
        </Button>
      </div>
      {balance > 0 && !canPay && (
        <p className="mt-2 text-sm text-muted-foreground print:hidden">
          This invoice already has {LIMITS.payments} payments, the most the demo
          allows.
        </p>
      )}
      {paying && (
        <PaymentDialog invoice={i} open={paying} onOpenChange={setPaying} />
      )}
    </RoleGate>
  );
}
