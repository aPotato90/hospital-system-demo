import { addDays, startOfDay } from "date-fns";
import { describe, expect, it } from "vitest";
import { ROLES } from "./roles";
import { SCHEMAS } from "./repo";
import { generateSeedData, SEED_COUNTS } from "./seed-generator";
import { DEPARTMENTS, LIMITS } from "./common";
import { sumLinesKobo, sumPaymentsKobo } from "./invoice";

const anchor = new Date(2026, 9, 18, 14, 30);
const data = generateSeedData(anchor);

describe("generateSeedData", () => {
  it("is deterministic for a given day", () => {
    expect(generateSeedData(new Date(2026, 9, 18, 7, 0))).toEqual(data);
    expect(generateSeedData(new Date(2026, 9, 19))).not.toEqual(data);
  });

  it("produces the expected counts", () => {
    expect(data.patients).toHaveLength(SEED_COUNTS.patients);
    expect(data.staff).toHaveLength(SEED_COUNTS.staff);
    expect(data.stockItems).toHaveLength(SEED_COUNTS.stockItems);
    expect(data.labTests).toHaveLength(SEED_COUNTS.labTests);
    expect(data.appointments).toHaveLength(SEED_COUNTS.appointments);
    const completed = data.appointments.filter((a) => a.status === "completed");
    expect(data.consultations).toHaveLength(completed.length);
    expect(data.invoices).toHaveLength(completed.length);
    expect(data.labOrders.length).toBeGreaterThan(5);
    expect(data.prescriptions.length).toBeGreaterThan(10);
  });

  it("passes every schema", () => {
    for (const [name, docs] of Object.entries(data)) {
      const schema = SCHEMAS[name as keyof typeof SCHEMAS];
      for (const { id, ...doc } of docs as { id: string }[]) {
        const result = schema.safeParse(doc);
        expect(result.error?.issues ?? [], `${name}/${id}`).toEqual([]);
      }
    }
  });

  it("uses unique ids and patient numbers", () => {
    for (const docs of Object.values(data) as { id: string }[][]) {
      expect(new Set(docs.map((d) => d.id)).size).toBe(docs.length);
    }
    expect(new Set(data.patients.map((p) => p.patientNo)).size).toBe(
      data.patients.length,
    );
  });

  it("keeps referential integrity", () => {
    const ids = (docs: { id: string }[]) => new Set(docs.map((d) => d.id));
    const patients = ids(data.patients);
    const doctors = ids(data.staff.filter((s) => s.role === "doctor"));
    const stock = ids(data.stockItems);
    const tests = ids(data.labTests);
    const appointments = new Map(data.appointments.map((a) => [a.id, a]));
    const consultations = new Map(data.consultations.map((c) => [c.id, c]));

    for (const a of data.appointments) {
      expect(patients.has(a.patientId)).toBe(true);
      expect(doctors.has(a.doctorId)).toBe(true);
      const doctor = data.staff.find((s) => s.id === a.doctorId)!;
      expect(doctor.department).toBe(a.department);
    }
    for (const c of data.consultations) {
      const appt = appointments.get(c.appointmentId)!;
      expect(appt.status).toBe("completed");
      expect(c.patientId).toBe(appt.patientId);
      expect(c.doctorId).toBe(appt.doctorId);
      c.prescriptions.forEach((p) =>
        expect(stock.has(p.stockItemId)).toBe(true),
      );
      c.labRequests.forEach((r) => expect(tests.has(r.testId)).toBe(true));
    }
    for (const o of data.labOrders) {
      expect(consultations.get(o.consultationId)?.patientId).toBe(o.patientId);
      expect(tests.has(o.testId)).toBe(true);
    }
    for (const p of data.prescriptions) {
      expect(consultations.get(p.consultationId)?.patientId).toBe(p.patientId);
      expect(stock.has(p.stockItemId)).toBe(true);
    }
    for (const i of data.invoices) {
      expect(consultations.get(i.consultationId)?.patientId).toBe(i.patientId);
    }
  });

  it("matches orders and invoices to each consultation", () => {
    for (const c of data.consultations) {
      const orders = data.labOrders.filter((o) => o.consultationId === c.id);
      const rx = data.prescriptions.filter((p) => p.consultationId === c.id);
      expect(orders.map((o) => o.testId)).toEqual(
        c.labRequests.map((r) => r.testId),
      );
      expect(rx.map((p) => p.stockItemId)).toEqual(
        c.prescriptions.map((p) => p.stockItemId),
      );
      const invoice = data.invoices.find((i) => i.consultationId === c.id)!;
      expect(invoice.lines).toHaveLength(1 + orders.length + rx.length);
      expect(invoice.totalKobo).toBe(sumLinesKobo(invoice.lines));
      expect(invoice.paidKobo).toBe(sumPaymentsKobo(invoice.payments));
    }
  });

  it("spreads appointments over the last 30 and next 7 days", () => {
    const day = startOfDay(anchor);
    const from = addDays(day, -30);
    const to = addDays(day, 8);
    for (const a of data.appointments) {
      expect(a.scheduledAt.getTime()).toBeGreaterThanOrEqual(from.getTime());
      expect(a.scheduledAt.getTime()).toBeLessThan(to.getTime());
      const future = a.scheduledAt >= addDays(day, 1);
      if (future) expect(["scheduled", "cancelled"]).toContain(a.status);
      if (a.scheduledAt < day) {
        expect(["completed", "cancelled", "no-show"]).toContain(a.status);
      }
    }
    const statuses = new Set(data.appointments.map((a) => a.status));
    expect(statuses).toEqual(
      new Set([
        "scheduled",
        "checked-in",
        "in-consultation",
        "completed",
        "cancelled",
        "no-show",
      ]),
    );
  });

  it("covers every role and department with staff", () => {
    expect(new Set(data.staff.map((s) => s.role))).toEqual(new Set(ROLES));
    expect(new Set(data.staff.map((s) => s.department))).toEqual(
      new Set(DEPARTMENTS),
    );
  });

  it("has paid, part-paid and unpaid invoices", () => {
    expect(new Set(data.invoices.map((i) => i.status))).toEqual(
      new Set(["paid", "part-paid", "unpaid"]),
    );
  });

  it("only uses fake contact details", () => {
    data.staff.forEach((s) => expect(s.email).toMatch(/@example\.com$/));
    data.patients.forEach((p) => {
      expect(p.phone).toMatch(/^\+234 800 555 \d{4}$/);
      expect(p.nextOfKin.phone).toMatch(/^\+234 800 555 \d{4}$/);
      expect(p.address).toMatch(/Demo/);
    });
  });

  it("stays within the array caps the rules enforce", () => {
    data.invoices.forEach((i) => {
      expect(i.lines.length).toBeLessThanOrEqual(LIMITS.invoiceLines);
      expect(i.payments.length).toBeLessThanOrEqual(LIMITS.payments);
    });
    data.consultations.forEach((c) => {
      expect(c.prescriptions.length).toBeLessThanOrEqual(LIMITS.prescriptions);
      expect(c.labRequests.length).toBeLessThanOrEqual(LIMITS.labRequests);
    });
  });

  it("fits in a single Firestore batch with room for meta and audit", () => {
    const total = Object.values(data).reduce((n, docs) => n + docs.length, 0);
    expect(total).toBeLessThanOrEqual(498);
  });
});
