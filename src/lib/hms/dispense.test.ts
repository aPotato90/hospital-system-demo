import { describe, expect, it } from "vitest";
import { allergyMentionsDrug, planDispense } from "./dispense";

const stock = { id: "stk-01", quantity: 20, unit: "tablet" };

describe("planDispense", () => {
  it("takes the prescribed quantity off the stock", () => {
    expect(
      planDispense(
        { status: "pending", quantity: 20, stockItemId: "stk-01" },
        stock,
      ),
    ).toEqual({ ok: true, newQuantity: 0 });
  });

  it("refuses when stock is insufficient, with a clear reason", () => {
    const plan = planDispense(
      { status: "pending", quantity: 21, stockItemId: "stk-01" },
      stock,
    );
    expect(plan).toEqual({
      ok: false,
      reason:
        "Not enough stock: 20 tablet(s) on hand, 21 needed. Receive stock first.",
    });
  });

  it("refuses dispensed prescriptions and missing items", () => {
    expect(
      planDispense(
        { status: "dispensed", quantity: 1, stockItemId: "stk-01" },
        stock,
      ).ok,
    ).toBe(false);
    expect(
      planDispense(
        { status: "pending", quantity: 1, stockItemId: "stk-01" },
        undefined,
      ).ok,
    ).toBe(false);
    expect(
      planDispense(
        { status: "pending", quantity: 1, stockItemId: "stk-02" },
        stock,
      ).ok,
    ).toBe(false);
  });
});

describe("allergyMentionsDrug (demo helper, not a safety check)", () => {
  it("matches a word from the allergy note in the drug name, either way", () => {
    expect(allergyMentionsDrug("Ibuprofen", "Ibuprofen 400 mg")).toBe(true);
    expect(
      allergyMentionsDrug("Rash with amoxicillin", "Amoxicillin 500 mg"),
    ).toBe(true);
    expect(allergyMentionsDrug("METRONIDAZOLE", "Metronidazole 400 mg")).toBe(
      true,
    );
  });

  it("does not flag unrelated or empty notes", () => {
    expect(allergyMentionsDrug("None known", "Ibuprofen 400 mg")).toBe(false);
    expect(allergyMentionsDrug("", "Ibuprofen 400 mg")).toBe(false);
    expect(allergyMentionsDrug("Peanuts", "Ibuprofen 400 mg")).toBe(false);
    // It knows nothing about drug classes: penicillin vs amoxicillin is not flagged.
    expect(allergyMentionsDrug("Penicillin", "Amoxicillin 500 mg")).toBe(false);
  });
});
