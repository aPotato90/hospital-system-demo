import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  appointmentsByDepartment,
  appointmentsTodayByStatus,
  dailyRevenue,
  labTestsOrdered,
  latestActivity,
  lowStockCount,
  outstandingBalance,
  patientRegistrations,
  pendingLabOrders,
  revenueThisMonth,
  stockValueByCategory,
} from "./metrics";

const tz = process.env.TZ;
beforeEach(() => {
  process.env.TZ = "Africa/Lagos";
});
afterEach(() => {
  process.env.TZ = tz;
});

// 10:00 on Sunday 18 Oct 2026 in Lagos (UTC+1).
const now = new Date("2026-10-18T09:00:00Z");
const pay = (iso: string, amountKobo: number) => ({
  amountKobo,
  method: "cash" as const,
  at: new Date(iso),
});

describe("patientRegistrations", () => {
  it("counts the total and the last 7 local days", () => {
    const patients = [
      { registeredAt: new Date("2026-10-12T00:30:00+01:00") }, // first of the 7 days
      { registeredAt: new Date("2026-10-11T23:59:00+01:00") }, // the day before
      { registeredAt: new Date("2026-10-18T08:00:00+01:00") },
    ];
    expect(patientRegistrations(patients, now)).toEqual({
      total: 3,
      last7Days: 2,
    });
  });
});

describe("appointmentsTodayByStatus", () => {
  it("uses the Lagos day, not the UTC day", () => {
    const r = appointmentsTodayByStatus(
      [
        // 23:30 UTC on the 17th is 00:30 on the 18th in Lagos: today.
        { scheduledAt: new Date("2026-10-17T23:30:00Z"), status: "scheduled" },
        { scheduledAt: new Date("2026-10-18T09:30:00Z"), status: "checked-in" },
        // 23:30 UTC on the 18th is the 19th in Lagos: tomorrow.
        { scheduledAt: new Date("2026-10-18T23:30:00Z"), status: "scheduled" },
      ],
      now,
    );
    expect(r.total).toBe(2);
    expect(r.counts.scheduled).toBe(1);
    expect(r.counts["checked-in"]).toBe(1);
  });
});

describe("revenue", () => {
  const invoices = [
    {
      payments: [
        pay("2026-09-30T23:30:00Z", 100), // 00:30 on 1 Oct in Lagos: this month
        pay("2026-09-30T22:30:00Z", 200), // 23:30 on 30 Sep in Lagos: last month
        pay("2026-10-18T08:00:00Z", 300),
      ],
    },
    { payments: [pay("2026-10-17T12:00:00Z", 400)] },
  ];

  it("sums this local calendar month", () => {
    expect(revenueThisMonth(invoices, now)).toBe(800);
  });

  it("buckets the last 30 local days, today last", () => {
    const days = dailyRevenue(invoices, now);
    expect(days).toHaveLength(30);
    expect(days[0].date).toBe("2026-09-19");
    expect(days.at(-1)).toEqual({
      date: "2026-10-18",
      label: "18 Oct",
      kobo: 300,
    });
    expect(days.find((d) => d.date === "2026-10-17")?.kobo).toBe(400);
    expect(days.find((d) => d.date === "2026-10-01")?.kobo).toBe(100);
    expect(days.find((d) => d.date === "2026-09-30")?.kobo).toBe(200);
  });

  it("totals the outstanding balance", () => {
    expect(
      outstandingBalance([
        { totalKobo: 1000, paidKobo: 250 },
        { totalKobo: 500, paidKobo: 500 },
      ]),
    ).toBe(750);
  });
});

describe("counts and breakdowns", () => {
  it("counts low stock and pending lab orders", () => {
    expect(
      lowStockCount([
        { quantity: 5, reorderLevel: 5 },
        { quantity: 6, reorderLevel: 5 },
      ]),
    ).toBe(1);
    expect(
      pendingLabOrders([
        { status: "requested" },
        { status: "collected" },
        { status: "resulted" },
      ]),
    ).toBe(2);
  });

  it("groups appointments by department, excluding cancelled", () => {
    expect(
      appointmentsByDepartment([
        { department: "Paediatrics", status: "completed" },
        { department: "Paediatrics", status: "cancelled" },
        { department: "Obstetrics", status: "scheduled" },
      ]),
    ).toEqual([
      { department: "General Practice", count: 0 },
      { department: "Paediatrics", count: 1 },
      { department: "Obstetrics", count: 1 },
    ]);
  });

  it("ranks lab tests and stock value by category", () => {
    expect(
      labTestsOrdered([{ name: "B" }, { name: "A" }, { name: "B" }]),
    ).toEqual([
      { name: "B", count: 2 },
      { name: "A", count: 1 },
    ]);
    expect(
      stockValueByCategory([
        { category: "X", quantity: 2, unitPriceKobo: 100 },
        { category: "Y", quantity: 1, unitPriceKobo: 500 },
        { category: "X", quantity: 1, unitPriceKobo: 50 },
      ]),
    ).toEqual([
      { category: "Y", valueKobo: 500 },
      { category: "X", valueKobo: 250 },
    ]);
  });

  it("lists the latest activity first", () => {
    const entries = [1, 3, 2].map((n) => ({
      id: String(n),
      at: new Date(2026, 9, n),
    }));
    expect(latestActivity(entries, 2).map((e) => e.id)).toEqual(["3", "2"]);
  });
});
