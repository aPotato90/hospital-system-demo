import { describe, expect, it } from "vitest";
import type { Appointment } from "./appointment";
import {
  buildInvoiceLines,
  ConsultationPlanError,
  consultationFormSchema,
  consultationLockReason,
  planConsultationSave,
  type ExistingConsultationRecords,
} from "./consultation-plan";
import { CONSULTATION_FEES_KOBO } from "./fees";
import { sumLinesKobo } from "./invoice";
import { LIMITS } from "./common";
import { generateSeedData } from "./seed-generator";

const data = generateSeedData(new Date(2026, 9, 18, 10));
const stockById = new Map(data.stockItems.map((s) => [s.id, s]));
const testById = new Map(data.labTests.map((t) => [t.id, t]));
const now = new Date(2026, 9, 18, 11, 0);

const appointment: Appointment = {
  id: "apt-x",
  patientId: "pat-001",
  doctorId: "stf-03",
  department: "General Practice",
  scheduledAt: new Date(2026, 9, 18, 10, 30),
  status: "in-consultation",
  reason: "Demo",
};
const none: ExistingConsultationRecords = {
  consultation: null,
  prescriptions: [],
  labOrders: [],
  invoice: null,
};

function ids() {
  let n = 0;
  return (c: string) => `${c}-${++n}`;
}

const values = {
  notes: "Demo note",
  diagnosis: "Demo diagnosis",
  prescriptions: [
    { stockItemId: "stk-01", dose: "1 tablet daily", quantity: 10 },
    { stockItemId: "stk-04", dose: "1 capsule daily", quantity: 15 },
  ],
  labRequests: [{ testId: "tst-01" }, { testId: "tst-02" }],
};

describe("consultationFormSchema", () => {
  it("requires a diagnosis and caps both lists", () => {
    expect(
      consultationFormSchema.safeParse({ ...values, diagnosis: "" }).success,
    ).toBe(false);
    const many = Array.from({ length: 11 }, (_, i) => ({
      stockItemId: `stk-${i}`,
      dose: "x",
      quantity: 1,
    }));
    expect(
      consultationFormSchema.safeParse({ ...values, prescriptions: many })
        .success,
    ).toBe(false);
    const tests = Array.from({ length: 11 }, (_, i) => ({
      testId: `tst-${i}`,
    }));
    expect(
      consultationFormSchema.safeParse({ ...values, labRequests: tests })
        .success,
    ).toBe(false);
  });

  it("rejects duplicates and bad quantities", () => {
    const dupe = consultationFormSchema.safeParse({
      ...values,
      prescriptions: [values.prescriptions[0], values.prescriptions[0]],
    });
    expect(dupe.error?.issues[0].message).toBe("Already on this prescription");
    const dupeTest = consultationFormSchema.safeParse({
      ...values,
      labRequests: [{ testId: "tst-01" }, { testId: "tst-01" }],
    });
    expect(dupeTest.error?.issues[0].message).toBe("Already requested");
    expect(
      consultationFormSchema.safeParse({
        ...values,
        prescriptions: [{ stockItemId: "stk-01", dose: "x", quantity: 0 }],
      }).success,
    ).toBe(false);
  });
});

describe("buildInvoiceLines", () => {
  const item = (n: number) => ({
    description: `Item ${n}`,
    quantity: 2,
    unitPriceKobo: 100,
  });

  it("lists every item when it fits", () => {
    const lines = buildInvoiceLines({
      department: "Paediatrics",
      labTests: [item(1)],
      pharmacyItems: [item(2), item(3)],
    });
    expect(lines.map((l) => l.kind)).toEqual([
      "consultation",
      "lab",
      "pharmacy",
      "pharmacy",
    ]);
    expect(lines[0].unitPriceKobo).toBe(CONSULTATION_FEES_KOBO.Paediatrics);
  });

  it("folds the larger group to stay within the line cap, keeping the total", () => {
    const labTests = Array.from({ length: 3 }, (_, i) => item(i));
    const pharmacyItems = Array.from({ length: 8 }, (_, i) => item(i + 10));
    const full =
      1_000_000 + [...labTests, ...pharmacyItems].reduce((s, i) => s + 200, 0);
    const lines = buildInvoiceLines({
      department: "General Practice",
      labTests,
      pharmacyItems,
    });
    expect(lines.length).toBeLessThanOrEqual(LIMITS.invoiceLines);
    expect(lines.filter((l) => l.kind === "lab")).toHaveLength(3);
    expect(lines.filter((l) => l.kind === "pharmacy")).toEqual([
      {
        description: "Pharmacy items (8)",
        quantity: 1,
        unitPriceKobo: 1600,
        kind: "pharmacy",
      },
    ]);
    expect(sumLinesKobo(lines)).toBe(full);
  });

  it("folds both groups for the maximum consultation (10 + 10)", () => {
    const ten = Array.from({ length: 10 }, (_, i) => item(i));
    const lines = buildInvoiceLines({
      department: "Obstetrics",
      labTests: ten,
      pharmacyItems: ten,
    });
    expect(lines).toHaveLength(3);
    expect(lines.map((l) => l.description)).toEqual([
      "Obstetrics consultation",
      "Laboratory tests (10)",
      "Pharmacy items (10)",
    ]);
    expect(sumLinesKobo(lines)).toBe(1_200_000 + 20 * 200);
  });
});

describe("planConsultationSave", () => {
  it("creates the consultation, pending prescriptions, requested lab orders and an invoice", () => {
    const plan = planConsultationSave({
      appointment,
      existing: none,
      values,
      stockById,
      testById,
      now,
      newId: ids(),
    });
    expect(plan.isNew).toBe(true);
    expect(plan.completeAppointment).toBe(true);
    const sets = plan.writes.filter((w) => w.op === "set");
    expect(sets.map((w) => w.collection)).toEqual([
      "consultations",
      "prescriptions",
      "prescriptions",
      "labOrders",
      "labOrders",
      "invoices",
    ]);
    const rx = sets
      .filter((w) => w.collection === "prescriptions")
      .map((w) => w.data);
    expect(rx.every((r) => "status" in r && r.status === "pending")).toBe(true);
    const labs = sets
      .filter((w) => w.collection === "labOrders")
      .map((w) => w.data);
    expect(labs.every((l) => "status" in l && l.status === "requested")).toBe(
      true,
    );
    const invoice = sets.find((w) => w.collection === "invoices")!.data as {
      lines: { kind: string }[];
      totalKobo: number;
      status: string;
    };
    expect(invoice.lines).toHaveLength(5);
    expect(invoice.status).toBe("unpaid");
    expect(invoice.totalKobo).toBe(
      1_000_000 + 10 * 2_000 + 15 * 6_000 + 500_000 + 250_000,
    );
  });

  it("requires the consultation to have been started", () => {
    expect(() =>
      planConsultationSave({
        appointment: { ...appointment, status: "checked-in" },
        existing: none,
        values,
        stockById,
        testById,
        now,
        newId: ids(),
      }),
    ).toThrow(ConsultationPlanError);
  });

  it("on edit keeps unchanged orders, deletes removed ones and adds new ones", () => {
    const first = planConsultationSave({
      appointment,
      existing: none,
      values,
      stockById,
      testById,
      now,
      newId: ids(),
    });
    const stored = <T>(c: string) =>
      first.writes
        .filter((w) => w.op === "set" && w.collection === c)
        .map((w) => ({ ...(w as { data: object }).data, id: w.id })) as T[];
    const existing: ExistingConsultationRecords = {
      consultation:
        stored<NonNullable<ExistingConsultationRecords["consultation"]>>(
          "consultations",
        )[0],
      prescriptions: stored("prescriptions"),
      labOrders: stored<ExistingConsultationRecords["labOrders"][number]>(
        "labOrders",
      ).map((o, i) => (i === 0 ? { ...o, status: "collected" as const } : o)),
      invoice:
        stored<NonNullable<ExistingConsultationRecords["invoice"]>>(
          "invoices",
        )[0],
    };
    const edit = planConsultationSave({
      appointment: { ...appointment, status: "completed" },
      existing,
      values: {
        ...values,
        prescriptions: [values.prescriptions[0]],
        labRequests: [{ testId: "tst-01" }, { testId: "tst-05" }],
      },
      stockById,
      testById,
      now,
      newId: ids(),
    });
    expect(edit.isNew).toBe(false);
    expect(edit.completeAppointment).toBe(false);
    expect(edit.consultationId).toBe(existing.consultation!.id);
    expect(edit.invoiceId).toBe(existing.invoice!.id);
    const deletes = edit.writes
      .filter((w) => w.op === "delete")
      .map((w) => w.id);
    expect(deletes).toEqual([
      existing.prescriptions[1].id,
      existing.labOrders[1].id,
    ]);
    const newLabs = edit.writes.filter(
      (w) => w.op === "set" && w.collection === "labOrders",
    );
    expect(newLabs).toHaveLength(1);
    // The collected sample for tst-01 is untouched.
    expect(edit.writes.some((w) => w.id === existing.labOrders[0].id)).toBe(
      false,
    );
  });

  it("refuses to edit once something has been dispensed, resulted or paid", () => {
    const base = { ...none, consultation: { id: "c" } as never };
    expect(
      consultationLockReason({
        ...base,
        prescriptions: [{ status: "dispensed" } as never],
      }),
    ).toMatch(/dispensed/);
    expect(
      consultationLockReason({
        ...base,
        labOrders: [{ status: "resulted" } as never],
      }),
    ).toMatch(/result/);
    expect(
      consultationLockReason({ ...base, invoice: { paidKobo: 100 } as never }),
    ).toMatch(/payment/);
    expect(consultationLockReason(base)).toBeNull();
  });
});
