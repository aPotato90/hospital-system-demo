import { describe, expect, it } from "vitest";
import { countLabOrdersByStatus, filterLabOrders } from "./lab-query";
import type { LabOrder } from "./lab-order";

const order = (id: string, over: Partial<LabOrder> = {}): LabOrder => ({
  id,
  consultationId: "c1",
  patientId: "p1",
  testId: "tst-01",
  name: "Full blood count",
  status: "requested",
  resultText: "",
  resultedAt: null,
  priceKobo: 500_000,
  ...over,
});
const patients = new Map([
  ["p1", { firstName: "Ada", lastName: "Demo", patientNo: "RDH-000101" }],
  ["p2", { firstName: "Obi", lastName: "Sample", patientNo: "RDH-000102" }],
]);
const consultations = new Map([
  ["c1", { createdAt: new Date("2026-10-18T09:00:00Z") }],
  ["c2", { createdAt: new Date("2026-10-17T23:30:00Z") }], // 00:30 on the 18th in Lagos
]);
const orders = [
  order("a"),
  order("b", {
    consultationId: "c2",
    patientId: "p2",
    testId: "tst-02",
    name: "Malaria parasite test",
  }),
  order("c", { status: "collected" }),
];

describe("filterLabOrders", () => {
  const base = {
    status: "requested" as const,
    testId: null,
    date: null,
    q: "",
  };

  it("filters by status, test and patient, oldest first", () => {
    expect(
      filterLabOrders(orders, base, patients, consultations).map((o) => o.id),
    ).toEqual(["b", "a"]);
    expect(
      filterLabOrders(
        orders,
        { ...base, testId: "tst-01" },
        patients,
        consultations,
      ).map((o) => o.id),
    ).toEqual(["a"]);
    expect(
      filterLabOrders(
        orders,
        { ...base, q: "sample" },
        patients,
        consultations,
      ).map((o) => o.id),
    ).toEqual(["b"]);
    expect(
      filterLabOrders(
        orders,
        { ...base, q: "000101" },
        patients,
        consultations,
      ).map((o) => o.id),
    ).toEqual(["a"]);
  });

  it("filters by the local order day (Africa/Lagos)", () => {
    const tz = process.env.TZ;
    process.env.TZ = "Africa/Lagos";
    try {
      const r = filterLabOrders(
        orders,
        { ...base, date: "2026-10-18" },
        patients,
        consultations,
      );
      expect(r.map((o) => o.id)).toEqual(["b", "a"]);
      expect(
        filterLabOrders(
          orders,
          { ...base, date: "2026-10-17" },
          patients,
          consultations,
        ),
      ).toEqual([]);
    } finally {
      process.env.TZ = tz;
    }
  });

  it("counts by status", () => {
    expect(countLabOrdersByStatus(orders)).toEqual({
      requested: 2,
      collected: 1,
      resulted: 0,
    });
  });
});
