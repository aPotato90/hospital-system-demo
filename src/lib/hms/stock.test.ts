import { describe, expect, it } from "vitest";
import { generateSeedData } from "./seed-generator";
import {
  makeReceiveStockSchema,
  queryStock,
  stockItemFormSchema,
  stockValueKobo,
  type StockFilter,
} from "./stock-item";

const stock = generateSeedData(new Date(2026, 9, 18)).stockItems;
const base: StockFilter = {
  q: "",
  category: null,
  lowOnly: false,
  sort: "name",
  dir: "asc",
};

describe("queryStock", () => {
  it("searches name and category", () => {
    expect(
      queryStock(stock, { ...base, q: "paracetamol" }).map((s) => s.name),
    ).toEqual(["Paracetamol 500 mg", "Paracetamol syrup 120 mg/5 ml"]);
    expect(queryStock(stock, { ...base, category: "IV fluid" })).toHaveLength(
      2,
    );
  });

  it("shows only low stock on request", () => {
    const low = queryStock(stock, { ...base, lowOnly: true });
    expect(low.length).toBeGreaterThan(0);
    expect(low.every((s) => s.quantity <= s.reorderLevel)).toBe(true);
  });

  it("sorts by each column both ways", () => {
    const byQty = queryStock(stock, { ...base, sort: "quantity" });
    for (let i = 1; i < byQty.length; i++)
      expect(byQty[i].quantity).toBeGreaterThanOrEqual(byQty[i - 1].quantity);
    const byValue = queryStock(stock, { ...base, sort: "value", dir: "desc" });
    for (let i = 1; i < byValue.length; i++)
      expect(stockValueKobo(byValue[i])).toBeLessThanOrEqual(
        stockValueKobo(byValue[i - 1]),
      );
    const byName = queryStock(stock, { ...base, dir: "desc" }).map(
      (s) => s.name,
    );
    expect(byName[0] >= byName[byName.length - 1]).toBe(true);
  });
});

describe("stock forms", () => {
  const valid = {
    name: "Demo syrup",
    category: "Analgesic",
    unit: "bottle",
    reorderLevel: 5,
    unitPriceNaira: 850.5,
    quantity: 10,
  };
  it("validates prices and counts", () => {
    expect(stockItemFormSchema.safeParse(valid).success).toBe(true);
    expect(
      stockItemFormSchema.safeParse({ ...valid, unitPriceNaira: -1 }).success,
    ).toBe(false);
    expect(
      stockItemFormSchema.safeParse({ ...valid, unitPriceNaira: 1.234 })
        .success,
    ).toBe(false);
    expect(
      stockItemFormSchema.safeParse({ ...valid, quantity: 1.5 }).success,
    ).toBe(false);
    expect(
      stockItemFormSchema.safeParse({ ...valid, reorderLevel: Number.NaN })
        .success,
    ).toBe(false);
  });

  it("receives at least one unit, up to the quantity limit", () => {
    const schema = makeReceiveStockSchema(99_990);
    expect(schema.safeParse({ received: 10 }).success).toBe(true);
    expect(schema.safeParse({ received: 11 }).success).toBe(false);
    expect(schema.safeParse({ received: 0 }).success).toBe(false);
    expect(schema.safeParse({ received: 2.5 }).success).toBe(false);
  });
});
