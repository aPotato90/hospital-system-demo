import { describe, expect, it } from "vitest";
import {
  applyPayment,
  filterInvoices,
  groupLinesByKind,
  invoiceTotals,
  makePaymentFormSchema,
  PaymentError,
} from "./billing";
import type { Invoice, InvoiceData } from "./invoice";
import { LIMITS } from "./common";

const at = new Date(2026, 9, 18, 12);
const invoice: InvoiceData = {
  patientId: "pat-001",
  consultationId: "con-001",
  lines: [
    {
      description: "General Practice consultation",
      quantity: 1,
      unitPriceKobo: 1_000_000,
      kind: "consultation",
    },
    {
      description: "Paracetamol 500 mg",
      quantity: 10,
      unitPriceKobo: 2_000,
      kind: "pharmacy",
    },
    {
      description: "Full blood count",
      quantity: 1,
      unitPriceKobo: 500_000,
      kind: "lab",
    },
  ],
  totalKobo: 1_520_000,
  paidKobo: 0,
  status: "unpaid",
  createdAt: at,
  payments: [],
};

describe("groupLinesByKind", () => {
  it("groups in consultation, lab, pharmacy order with subtotals", () => {
    expect(
      groupLinesByKind(invoice.lines).map((g) => [g.label, g.subtotalKobo]),
    ).toEqual([
      ["Consultation", 1_000_000],
      ["Laboratory", 500_000],
      ["Pharmacy", 20_000],
    ]);
  });
});

describe("payment form", () => {
  const schema = makePaymentFormSchema(1_520_000);
  it("accepts amounts up to the balance", () => {
    expect(
      schema.safeParse({ amountNaira: 15_200, method: "cash" }).success,
    ).toBe(true);
    expect(
      schema.safeParse({ amountNaira: 0.01, method: "card" }).success,
    ).toBe(true);
  });
  it.each([
    ["zero", 0],
    ["negative", -5],
    ["over the balance", 15_200.01],
    ["three decimals", 1.005],
    ["not a number", Number.NaN],
  ])("rejects %s", (_, amountNaira) => {
    expect(schema.safeParse({ amountNaira, method: "cash" }).success).toBe(
      false,
    );
  });
});

describe("applyPayment", () => {
  it("moves unpaid -> part-paid -> paid", () => {
    const part = applyPayment(invoice, {
      amountKobo: 520_000,
      method: "cash",
      at,
    });
    expect([part.paidKobo, part.status, part.payments.length]).toEqual([
      520_000,
      "part-paid",
      1,
    ]);
    const paid = applyPayment(part, {
      amountKobo: 1_000_000,
      method: "transfer",
      at,
    });
    expect([paid.paidKobo, paid.status]).toEqual([1_520_000, "paid"]);
  });

  it("refuses overpayment, zero and the payment cap", () => {
    expect(() =>
      applyPayment(invoice, { amountKobo: 1_520_001, method: "cash", at }),
    ).toThrow(PaymentError);
    expect(() =>
      applyPayment(invoice, { amountKobo: 0, method: "cash", at }),
    ).toThrow(PaymentError);
    const full = {
      ...invoice,
      payments: Array.from({ length: LIMITS.payments }, () => ({
        amountKobo: 1,
        method: "cash" as const,
        at,
      })),
      paidKobo: LIMITS.payments,
      status: "part-paid" as const,
    };
    expect(() =>
      applyPayment(full, { amountKobo: 1, method: "cash", at }),
    ).toThrow(/20 payments/);
  });
});

describe("invoice list", () => {
  const list: Invoice[] = [
    { ...invoice, id: "a", createdAt: new Date(2026, 9, 1) },
    {
      ...invoice,
      id: "b",
      patientId: "pat-002",
      status: "paid",
      paidKobo: 1_520_000,
      createdAt: new Date(2026, 9, 2),
    },
  ];
  const label = (id: string) =>
    id === "pat-001" ? "Ada Demo RDH-000101" : "Obi Demo RDH-000102";

  it("filters by status and patient, newest first", () => {
    expect(
      filterInvoices(list, label, { status: null, q: "" }).map((i) => i.id),
    ).toEqual(["b", "a"]);
    expect(
      filterInvoices(list, label, { status: "paid", q: "" }).map((i) => i.id),
    ).toEqual(["b"]);
    expect(
      filterInvoices(list, label, { status: null, q: "000101" }).map(
        (i) => i.id,
      ),
    ).toEqual(["a"]);
  });

  it("totals total, paid and balance", () => {
    expect(invoiceTotals(list)).toEqual({
      totalKobo: 3_040_000,
      paidKobo: 1_520_000,
      balanceKobo: 1_520_000,
    });
  });
});
