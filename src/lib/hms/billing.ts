import { z } from "zod";
import { LIMITS } from "./common";
import {
  invoiceBalanceKobo,
  PAYMENT_METHODS,
  sumPaymentsKobo,
  type Invoice,
  type InvoiceData,
  type InvoiceLine,
  type Payment,
} from "./invoice";
import { nairaToKobo } from "./money";
import { invoiceStatusFor, type InvoiceStatus } from "./transitions";

export const LINE_KIND_LABELS: Record<InvoiceLine["kind"], string> = {
  consultation: "Consultation",
  lab: "Laboratory",
  pharmacy: "Pharmacy",
};

/** Invoice lines grouped by kind, in a fixed order, with subtotals. */
export function groupLinesByKind(lines: readonly InvoiceLine[]) {
  return (Object.keys(LINE_KIND_LABELS) as InvoiceLine["kind"][])
    .map((kind) => {
      const group = lines.filter((l) => l.kind === kind);
      return {
        kind,
        label: LINE_KIND_LABELS[kind],
        lines: group,
        subtotalKobo: group.reduce(
          (s, l) => s + l.quantity * l.unitPriceKobo,
          0,
        ),
      };
    })
    .filter((g) => g.lines.length > 0);
}

/**
 * "Record payment" form for one invoice: an amount in naira (up to two
 * decimals) from ₦0.01 to the balance, and a method. Demo only: no money moves.
 */
export function makePaymentFormSchema(balanceKobo: number) {
  return z.object({
    amountNaira: z
      .number({ error: "Enter an amount" })
      .refine((n) => Number.isFinite(n), "Enter an amount")
      .refine((n) => n > 0, "Enter an amount greater than zero")
      .refine(
        (n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6,
        "Use at most two decimal places",
      )
      .refine(
        (n) => nairaToKobo(n) <= balanceKobo,
        "Cannot be more than the balance",
      ),
    method: z.enum(PAYMENT_METHODS),
  });
}
export type PaymentFormValues = z.infer<
  ReturnType<typeof makePaymentFormSchema>
>;

export class PaymentError extends Error {}

/**
 * The invoice after appending one payment. Mirrors the rules: one payment per
 * write, at least 1 kobo, never more than the balance, at most
 * LIMITS.payments payments, status derived from the amounts.
 */
export function applyPayment(
  invoice: InvoiceData,
  payment: Payment,
): InvoiceData {
  if (!Number.isInteger(payment.amountKobo) || payment.amountKobo < 1) {
    throw new PaymentError("Enter an amount greater than zero.");
  }
  if (payment.amountKobo > invoiceBalanceKobo(invoice)) {
    throw new PaymentError("The payment is more than the balance.");
  }
  if (invoice.payments.length >= LIMITS.payments) {
    throw new PaymentError(
      `This invoice already has ${LIMITS.payments} payments, the most the demo allows.`,
    );
  }
  const payments = [...invoice.payments, payment];
  const paidKobo = sumPaymentsKobo(payments);
  return {
    ...invoice,
    payments,
    paidKobo,
    status: invoiceStatusFor(invoice.totalKobo, paidKobo),
  };
}

export type InvoiceFilter = { status: InvoiceStatus | null; q: string };

/** Filter invoices by status and patient name / number, newest first. */
export function filterInvoices(
  invoices: readonly Invoice[],
  patientLabel: (patientId: string) => string,
  filter: InvoiceFilter,
): Invoice[] {
  const q = filter.q.trim().toLowerCase();
  return invoices
    .filter((i) => !filter.status || i.status === filter.status)
    .filter((i) => !q || patientLabel(i.patientId).toLowerCase().includes(q))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function invoiceTotals(invoices: readonly Invoice[]) {
  return invoices.reduce(
    (t, i) => ({
      totalKobo: t.totalKobo + i.totalKobo,
      paidKobo: t.paidKobo + i.paidKobo,
      balanceKobo: t.balanceKobo + invoiceBalanceKobo(i),
    }),
    { totalKobo: 0, paidKobo: 0, balanceKobo: 0 },
  );
}
