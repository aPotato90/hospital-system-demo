import { describe, expect, it } from "vitest";
import {
  bookAppointmentFormSchema,
  combineDateTime,
  formatPatientNo,
  invoiceSchema,
  labOrderSchema,
  nextPatientNo,
  patientFormSchema,
  prescriptionSchema,
  staffSchema,
  type InvoiceData,
  type PatientFormValues,
} from "./index";

const validPatient: PatientFormValues = {
  firstName: "Ada",
  lastName: "Demo",
  dateOfBirth: "1990-04-12",
  sex: "female",
  phone: "+234 800 555 0101",
  address: "1 Mango Avenue, Riverside Demo Estate, Lagos",
  nextOfKin: { name: "Obi Demo", phone: "+234 800 555 0102" },
  allergies: "None known",
};

describe("patientFormSchema", () => {
  it("accepts a valid patient and trims text", () => {
    const parsed = patientFormSchema.parse({
      ...validPatient,
      firstName: "  Ada ",
    });
    expect(parsed.firstName).toBe("Ada");
  });

  it.each([
    ["empty first name", { firstName: "" }],
    ["long last name", { lastName: "x".repeat(121) }],
    ["impossible date", { dateOfBirth: "2023-02-30" }],
    ["future date", { dateOfBirth: "2999-01-01" }],
    ["letters in phone", { phone: "call me maybe" }],
    ["long allergies", { allergies: "x".repeat(301) }],
  ])("rejects %s", (_, patch) => {
    expect(
      patientFormSchema.safeParse({ ...validPatient, ...patch }).success,
    ).toBe(false);
  });
});

describe("patient numbers", () => {
  it("formats and increments", () => {
    expect(formatPatientNo(123)).toBe("RDH-000123");
    expect(nextPatientNo(["RDH-000101", "RDH-000140", "RDH-000120"])).toBe(
      "RDH-000141",
    );
    expect(nextPatientNo([])).toBe("RDH-000001");
  });
});

describe("bookAppointmentFormSchema", () => {
  const valid = {
    patientId: "pat-001",
    department: "Paediatrics",
    doctorId: "stf-05",
    date: "2026-10-20",
    time: "09:30",
    reason: "Routine check",
  } as const;

  it("accepts clinic hours and rejects times outside them", () => {
    expect(bookAppointmentFormSchema.safeParse(valid).success).toBe(true);
    expect(
      bookAppointmentFormSchema.safeParse({ ...valid, time: "07:59" }).success,
    ).toBe(false);
    expect(
      bookAppointmentFormSchema.safeParse({ ...valid, time: "17:01" }).success,
    ).toBe(false);
  });

  it("only books clinical departments", () => {
    expect(
      bookAppointmentFormSchema.safeParse({ ...valid, department: "Pharmacy" })
        .success,
    ).toBe(false);
  });

  it("combines date and time in local time", () => {
    const d = combineDateTime("2026-10-20", "09:30");
    expect([
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      d.getHours(),
      d.getMinutes(),
    ]).toEqual([2026, 9, 20, 9, 30]);
  });
});

describe("invoiceSchema", () => {
  const base: InvoiceData = {
    patientId: "pat-001",
    consultationId: "con-001",
    lines: [
      {
        description: "Consultation",
        quantity: 1,
        unitPriceKobo: 1_000_000,
        kind: "consultation",
      },
      {
        description: "Paracetamol",
        quantity: 10,
        unitPriceKobo: 2_000,
        kind: "pharmacy",
      },
    ],
    totalKobo: 1_020_000,
    paidKobo: 20_000,
    status: "part-paid",
    createdAt: new Date(),
    payments: [{ amountKobo: 20_000, method: "cash", at: new Date() }],
  };

  it("accepts consistent totals", () => {
    expect(invoiceSchema.safeParse(base).success).toBe(true);
  });

  it.each([
    ["wrong total", { totalKobo: 1 }],
    ["paid not matching payments", { paidKobo: 1 }],
    ["status not matching amounts", { status: "paid" }],
    ["fractional kobo", { totalKobo: 1_020_000.5 }],
    ["no lines", { lines: [], totalKobo: 0 }],
  ] as const)("rejects %s", (_, patch) => {
    expect(invoiceSchema.safeParse({ ...base, ...patch }).success).toBe(false);
  });

  it("caps lines and payments", () => {
    const line = base.lines[1];
    const lines = Array.from({ length: 11 }, () => line);
    expect(
      invoiceSchema.safeParse({ ...base, lines, totalKobo: 11 * 20_000 })
        .success,
    ).toBe(false);
  });
});

describe("lab orders and prescriptions", () => {
  it("only resulted lab orders carry a result", () => {
    const order = {
      consultationId: "con-1",
      patientId: "pat-1",
      testId: "tst-1",
      name: "Full blood count",
      status: "requested",
      resultText: "",
      resultedAt: null,
      priceKobo: 500_000,
    } as const;
    expect(labOrderSchema.safeParse(order).success).toBe(true);
    expect(
      labOrderSchema.safeParse({ ...order, resultText: "x" }).success,
    ).toBe(false);
    expect(
      labOrderSchema.safeParse({
        ...order,
        status: "resulted",
        resultText: "ok",
        resultedAt: new Date(),
      }).success,
    ).toBe(true);
    expect(
      labOrderSchema.safeParse({ ...order, status: "resulted" }).success,
    ).toBe(false);
  });

  it("only dispensed prescriptions carry a dispensed time", () => {
    const rx = {
      consultationId: "con-1",
      patientId: "pat-1",
      stockItemId: "stk-1",
      name: "Paracetamol",
      quantity: 10,
      status: "pending",
      dispensedAt: null,
    } as const;
    expect(prescriptionSchema.safeParse(rx).success).toBe(true);
    expect(
      prescriptionSchema.safeParse({ ...rx, status: "dispensed" }).success,
    ).toBe(false);
  });
});

describe("staffSchema", () => {
  it("only allows example.com emails", () => {
    const staff = {
      name: "Demo Person",
      role: "doctor",
      department: "Paediatrics",
    } as const;
    expect(
      staffSchema.safeParse({ ...staff, email: "demo.person@example.com" })
        .success,
    ).toBe(true);
    expect(
      staffSchema.safeParse({ ...staff, email: "someone@mail.test" }).success,
    ).toBe(false);
  });
});
