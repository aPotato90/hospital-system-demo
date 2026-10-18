import { describe, expect, it } from "vitest";
import {
  describeCascade,
  invoiceReplaySteps,
  planPatientDeletion,
  type PatientRecords,
} from "./cascade";
import { generateSeedData } from "./seed-generator";

const data = generateSeedData(new Date(2026, 9, 18));

function recordsFor(): PatientRecords {
  return {
    appointments: data.appointments,
    consultations: data.consultations,
    labOrders: data.labOrders,
    prescriptions: data.prescriptions,
    invoices: data.invoices,
  };
}

describe("planPatientDeletion", () => {
  const withHistory = data.patients.find((p) =>
    data.consultations.some((c) => c.patientId === p.id),
  )!;

  it("cascades only to the patient's own records, children first", () => {
    const plan = planPatientDeletion(withHistory, recordsFor());
    const own = (docs: { patientId: string }[]) =>
      docs.filter((d) => d.patientId === withHistory.id).length;

    expect(plan.counts).toEqual({
      appointments: own(data.appointments),
      consultations: own(data.consultations),
      labOrders: own(data.labOrders),
      prescriptions: own(data.prescriptions),
      invoices: own(data.invoices),
    });
    expect(plan.deletes.at(-1)).toEqual({
      collection: "patients",
      id: withHistory.id,
    });
    const order = plan.deletes.map((d) => d.collection);
    expect(order.indexOf("consultations")).toBeGreaterThan(
      order.lastIndexOf("invoices"),
    );
    expect(order.indexOf("appointments")).toBeGreaterThan(
      order.lastIndexOf("consultations"),
    );
  });

  it("restores exactly what it deletes, parents first", () => {
    const plan = planPatientDeletion(withHistory, recordsFor());
    expect(plan.restore.map((w) => `${w.collection}/${w.id}`).sort()).toEqual(
      plan.deletes.map((d) => `${d.collection}/${d.id}`).sort(),
    );
    expect(plan.restore[0]).toMatchObject({
      collection: "patients",
      id: withHistory.id,
    });
    expect(plan.restore[0].data).not.toHaveProperty("id");
    expect(plan.restore[0].data).toMatchObject({
      patientNo: withHistory.patientNo,
    });
  });

  it("ignores records that belong to someone else", () => {
    const other = data.patients.find((p) => p.id !== withHistory.id)!;
    const records = recordsFor();
    const plan = planPatientDeletion(other, {
      ...records,
      appointments: records.appointments.filter(
        (a) => a.patientId === withHistory.id,
      ),
    });
    expect(plan.counts.appointments).toBe(0);
  });

  it("follows lab orders through the patient's consultations", () => {
    const consultation = data.consultations.find(
      (c) => c.patientId === withHistory.id,
    )!;
    const stray = {
      ...data.labOrders[0],
      id: "lab-x",
      patientId: "someone-else",
      consultationId: consultation.id,
    };
    const plan = planPatientDeletion(withHistory, {
      ...recordsFor(),
      labOrders: [stray],
    });
    expect(plan.counts.labOrders).toBe(1);
  });

  it("blocks deletion while a visit is in progress", () => {
    const appt = data.appointments.find((a) => a.status === "checked-in")!;
    const patient = data.patients.find((p) => p.id === appt.patientId)!;
    const plan = planPatientDeletion(patient, recordsFor());
    expect(plan.blockedReason).toMatch(/visit in progress/);
  });

  it("allows deleting a patient with no records", () => {
    const patient = { ...data.patients[0], id: "pat-new" };
    const plan = planPatientDeletion(patient, recordsFor());
    expect(plan.blockedReason).toBeNull();
    expect(plan.deletes).toEqual([{ collection: "patients", id: "pat-new" }]);
    expect(describeCascade(plan.counts)).toBe("no other records");
  });
});

describe("describeCascade", () => {
  it("lists non-zero counts in plain English", () => {
    expect(
      describeCascade({
        appointments: 3,
        consultations: 1,
        labOrders: 0,
        prescriptions: 2,
        invoices: 1,
      }),
    ).toBe("3 appointments, 1 consultation, 2 prescriptions and 1 invoice");
    expect(
      describeCascade({
        appointments: 1,
        consultations: 0,
        labOrders: 0,
        prescriptions: 0,
        invoices: 0,
      }),
    ).toBe("1 appointment");
  });
});

describe("invoiceReplaySteps", () => {
  it("replays payments one at a time with matching totals and status", () => {
    const at = new Date();
    const invoice = {
      ...data.invoices[0],
      totalKobo: 10_000,
      payments: [
        { amountKobo: 2_000, method: "cash" as const, at },
        { amountKobo: 3_000, method: "card" as const, at },
        { amountKobo: 5_000, method: "transfer" as const, at },
      ],
      paidKobo: 10_000,
      status: "paid" as const,
    };
    const steps = invoiceReplaySteps(invoice);
    expect(steps.map((s) => s.payments.length)).toEqual([1, 2, 3]);
    expect(steps.map((s) => s.paidKobo)).toEqual([2_000, 5_000, 10_000]);
    expect(steps.map((s) => s.status)).toEqual([
      "part-paid",
      "part-paid",
      "paid",
    ]);
    expect(steps.at(-1)).toEqual(invoice);
  });

  it("is a single step for zero or one payment", () => {
    const unpaid = {
      ...data.invoices[0],
      payments: [],
      paidKobo: 0,
      status: "unpaid" as const,
      totalKobo: 5,
    };
    expect(invoiceReplaySteps(unpaid)).toEqual([unpaid]);
  });
});
