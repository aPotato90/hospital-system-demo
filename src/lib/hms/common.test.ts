import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LIMITS } from "./common";
import {
  APPOINTMENT_TRANSITIONS,
  INVOICE_TRANSITIONS,
  LAB_ORDER_TRANSITIONS,
  PRESCRIPTION_TRANSITIONS,
} from "./transitions";

const rules = readFileSync(
  new URL("../../../firestore.rules", import.meta.url),
  "utf8",
);

function ruleConstant(name: string): number {
  const match = rules.match(
    new RegExp(`function ${name}\\(\\) \\{ return (\\d+); \\}`),
  );
  if (!match) throw new Error(`firestore.rules has no ${name}()`);
  return Number(match[1]);
}

function ruleTable(name: string): Record<string, string[]> {
  const match = rules.match(
    new RegExp(
      `function ${name}\\(\\) \\{\\s*return (\\{[\\s\\S]*?\\});\\s*\\}`,
    ),
  );
  if (!match) throw new Error(`firestore.rules has no ${name}()`);
  return JSON.parse(match[1].replace(/'/g, '"'));
}

/** Upper bound of the `{min,max}` regex quantifier inside a rules function. */
function regexBound(fn: string): number {
  const body = rules.match(
    new RegExp(`function ${fn}\\(v\\) \\{[\\s\\S]*?\\n    \\}`),
  );
  const bound = body?.[0].match(/\{\d+,(\d+)\}\)?\$/);
  if (!bound)
    throw new Error(`firestore.rules has no bounded regex in ${fn}()`);
  return Number(bound[1]);
}

describe("firestore.rules mirrors the TypeScript limits", () => {
  it.each([
    ["maxText", LIMITS.text],
    ["maxKobo", LIMITS.kobo],
    ["maxQuantity", LIMITS.quantity],
    ["maxInvoiceLines", LIMITS.invoiceLines],
    ["maxPayments", LIMITS.payments],
    ["maxPrescriptions", LIMITS.prescriptions],
    ["maxLabRequests", LIMITS.labRequests],
  ])("%s() == %d", (name, value) => {
    expect(ruleConstant(name)).toBe(value);
  });

  it.each([
    ["isId", LIMITS.id],
    ["isName", LIMITS.name],
    ["isLabel", LIMITS.label],
    ["isShortText", LIMITS.shortText],
    ["isRequiredShortText", LIMITS.shortText],
    ["isAddress", LIMITS.address],
    ["isPhone", LIMITS.phone],
  ])("%s() allows at most %d characters", (fn, max) => {
    expect(regexBound(fn)).toBe(max);
  });

  it("inline element checks use the same limits", () => {
    const expected: Record<string, number> = {
      stockItemId: LIMITS.id,
      testId: LIMITS.id,
      name: LIMITS.name,
      description: LIMITS.name,
      dose: LIMITS.shortText,
    };
    const found = [
      ...rules.matchAll(/p\.(\w+)\.matches\('[^']*\{\d+,(\d+)\}\$'\)/g),
    ];
    expect(found.length).toBeGreaterThanOrEqual(5);
    for (const [, field, bound] of found)
      expect(Number(bound), field).toBe(expected[field]);

    const numbers = [...rules.matchAll(/p\.\w+ <= (\d+)/g)].map((m) =>
      Number(m[1]),
    );
    expect(numbers.length).toBeGreaterThanOrEqual(4);
    for (const n of numbers)
      expect([LIMITS.quantity, LIMITS.kobo]).toContain(n);
  });

  it("checks every array element up to the cap", () => {
    expect(rules.match(/isInvoiceLine\(v\[(\d+)\]\)/g)).toHaveLength(
      LIMITS.invoiceLines,
    );
    expect(
      rules.match(/isConsultationPrescription\(v\[(\d+)\]\)/g),
    ).toHaveLength(LIMITS.prescriptions);
    expect(rules.match(/isLabRequest\(v\[(\d+)\]\)/g)).toHaveLength(
      LIMITS.labRequests,
    );
  });
});

describe("firestore.rules mirrors the status transition tables", () => {
  it.each([
    ["appointmentTransitions", APPOINTMENT_TRANSITIONS],
    ["labOrderTransitions", LAB_ORDER_TRANSITIONS],
    ["prescriptionTransitions", PRESCRIPTION_TRANSITIONS],
    ["invoiceTransitions", INVOICE_TRANSITIONS],
  ])("%s", (name, table) => {
    expect(ruleTable(name)).toEqual(table);
  });
});
