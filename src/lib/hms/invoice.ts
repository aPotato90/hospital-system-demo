import { z } from "zod";
import {
  idSchema,
  koboSchema,
  LIMITS,
  quantitySchema,
  type WithId,
} from "./common";
import { INVOICE_STATUSES, invoiceStatusFor } from "./transitions";

export const INVOICE_LINE_KINDS = ["consultation", "lab", "pharmacy"] as const;
export const PAYMENT_METHODS = ["cash", "card", "transfer"] as const;

export const invoiceLineSchema = z.object({
  description: z.string().trim().min(1).max(LIMITS.name),
  quantity: quantitySchema.min(1),
  unitPriceKobo: koboSchema,
  kind: z.enum(INVOICE_LINE_KINDS),
});
export type InvoiceLine = z.infer<typeof invoiceLineSchema>;

export const paymentSchema = z.object({
  amountKobo: koboSchema.min(1),
  method: z.enum(PAYMENT_METHODS),
  at: z.date(),
});
export type Payment = z.infer<typeof paymentSchema>;

export function lineTotalKobo(
  line: Pick<InvoiceLine, "quantity" | "unitPriceKobo">,
) {
  return line.quantity * line.unitPriceKobo;
}

export function sumLinesKobo(lines: readonly InvoiceLine[]) {
  return lines.reduce((sum, l) => sum + lineTotalKobo(l), 0);
}

export function sumPaymentsKobo(payments: readonly Payment[]) {
  return payments.reduce((sum, p) => sum + p.amountKobo, 0);
}

/** Stored document under users/{uid}/invoices/{invoiceId}. */
export const invoiceSchema = z
  .object({
    patientId: idSchema,
    consultationId: idSchema,
    lines: z.array(invoiceLineSchema).min(1).max(LIMITS.invoiceLines),
    totalKobo: koboSchema,
    paidKobo: koboSchema,
    status: z.enum(INVOICE_STATUSES),
    createdAt: z.date(),
    payments: z.array(paymentSchema).max(LIMITS.payments),
  })
  .refine((i) => i.totalKobo === sumLinesKobo(i.lines), {
    message: "Total must equal the sum of the lines",
    path: ["totalKobo"],
  })
  .refine((i) => i.paidKobo === sumPaymentsKobo(i.payments), {
    message: "Paid must equal the sum of the payments",
    path: ["paidKobo"],
  })
  .refine((i) => i.paidKobo <= i.totalKobo, {
    message: "Cannot pay more than the total",
    path: ["paidKobo"],
  })
  .refine((i) => i.status === invoiceStatusFor(i.totalKobo, i.paidKobo), {
    message: "Status must match the amounts",
    path: ["status"],
  });
export type InvoiceData = z.infer<typeof invoiceSchema>;
export type Invoice = WithId<InvoiceData>;

export function invoiceBalanceKobo(
  i: Pick<InvoiceData, "totalKobo" | "paidKobo">,
) {
  return i.totalKobo - i.paidKobo;
}
