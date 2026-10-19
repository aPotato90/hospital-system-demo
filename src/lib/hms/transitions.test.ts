import { describe, expect, it } from "vitest";
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_TRANSITIONS,
  canTransition,
  INVOICE_STATUSES,
  INVOICE_TRANSITIONS,
  invoiceStatusFor,
  LAB_ORDER_STATUSES,
  LAB_ORDER_TRANSITIONS,
  PRESCRIPTION_STATUSES,
  PRESCRIPTION_TRANSITIONS,
  RECEPTION_ACTIONS,
} from "./transitions";

describe("status transition tables", () => {
  it.each([
    ["appointment", APPOINTMENT_STATUSES, APPOINTMENT_TRANSITIONS],
    ["lab order", LAB_ORDER_STATUSES, LAB_ORDER_TRANSITIONS],
    ["prescription", PRESCRIPTION_STATUSES, PRESCRIPTION_TRANSITIONS],
    ["invoice", INVOICE_STATUSES, INVOICE_TRANSITIONS],
  ] as const)(
    "%s table covers every status and only known targets",
    (_, statuses, table) => {
      expect(Object.keys(table).sort()).toEqual([...statuses].sort());
      for (const targets of Object.values(table) as string[][]) {
        for (const t of targets) expect(statuses).toContain(t);
      }
    },
  );

  it("appointments follow the front-desk flow", () => {
    const allowed = (from: string, to: string) =>
      canTransition(APPOINTMENT_TRANSITIONS, from as never, to as never);
    expect(allowed("scheduled", "checked-in")).toBe(true);
    expect(allowed("scheduled", "cancelled")).toBe(true);
    expect(allowed("scheduled", "no-show")).toBe(true);
    expect(allowed("checked-in", "in-consultation")).toBe(true);
    expect(allowed("checked-in", "cancelled")).toBe(true);
    expect(allowed("in-consultation", "completed")).toBe(true);
    expect(allowed("scheduled", "completed")).toBe(false);
    expect(allowed("checked-in", "no-show")).toBe(false);
    expect(allowed("completed", "scheduled")).toBe(false);
    expect(allowed("cancelled", "scheduled")).toBe(false);
    expect(allowed("no-show", "checked-in")).toBe(false);
  });

  it("terminal statuses have no way out", () => {
    for (const s of ["completed", "cancelled", "no-show"] as const) {
      expect(APPOINTMENT_TRANSITIONS[s]).toEqual([]);
    }
    expect(LAB_ORDER_TRANSITIONS.resulted).toEqual(["collected"]);
    expect(PRESCRIPTION_TRANSITIONS.dispensed).toEqual([]);
    expect(INVOICE_TRANSITIONS.paid).toEqual([]);
  });

  it("lab orders move forward, with an undo from resulted to collected", () => {
    expect(canTransition(LAB_ORDER_TRANSITIONS, "requested", "collected")).toBe(
      true,
    );
    expect(canTransition(LAB_ORDER_TRANSITIONS, "requested", "resulted")).toBe(
      false,
    );
    expect(canTransition(LAB_ORDER_TRANSITIONS, "resulted", "collected")).toBe(
      true,
    );
    expect(canTransition(LAB_ORDER_TRANSITIONS, "resulted", "requested")).toBe(
      false,
    );
    expect(
      canTransition(PRESCRIPTION_TRANSITIONS, "pending", "dispensed"),
    ).toBe(true);
    expect(
      canTransition(PRESCRIPTION_TRANSITIONS, "dispensed", "pending"),
    ).toBe(false);
  });

  it("staying in the same status is always allowed", () => {
    for (const s of APPOINTMENT_STATUSES) {
      expect(canTransition(APPOINTMENT_TRANSITIONS, s, s)).toBe(true);
    }
  });

  it("reception actions are all allowed from scheduled", () => {
    for (const action of RECEPTION_ACTIONS) {
      expect(APPOINTMENT_TRANSITIONS.scheduled).toContain(action.to);
    }
  });
});

describe("invoiceStatusFor", () => {
  it("derives the status from the amounts", () => {
    expect(invoiceStatusFor(10_000, 0)).toBe("unpaid");
    expect(invoiceStatusFor(10_000, 1)).toBe("part-paid");
    expect(invoiceStatusFor(10_000, 9_999)).toBe("part-paid");
    expect(invoiceStatusFor(10_000, 10_000)).toBe("paid");
    expect(invoiceStatusFor(0, 0)).toBe("paid");
  });
});
