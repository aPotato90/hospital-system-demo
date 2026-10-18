import { z } from "zod";
import {
  koboSchema,
  labelSchema,
  LIMITS,
  nameSchema,
  quantitySchema,
  type WithId,
} from "./common";

/** Stored document under users/{uid}/stockItems/{stockItemId}. */
export const stockItemSchema = z.object({
  name: nameSchema,
  category: labelSchema,
  /** Dispensing unit, e.g. "tablet", "bottle". */
  unit: labelSchema,
  quantity: quantitySchema,
  reorderLevel: quantitySchema,
  unitPriceKobo: koboSchema,
});
export type StockItemData = z.infer<typeof stockItemSchema>;
export type StockItem = WithId<StockItemData>;

export function isLowStock(
  item: Pick<StockItemData, "quantity" | "reorderLevel">,
) {
  return item.quantity <= item.reorderLevel;
}

/** Add/edit stock item form. Prices are typed in naira and stored as kobo. */
export const stockItemFormSchema = z.object({
  name: nameSchema,
  category: labelSchema,
  unit: labelSchema,
  reorderLevel: z.number({ error: "Enter a number" }).pipe(quantitySchema),
  unitPriceNaira: z
    .number({ error: "Enter a price" })
    .min(0, "Cannot be negative")
    .max(LIMITS.kobo / 100, "Too large")
    .refine(
      (n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6,
      "Use at most two decimal places",
    ),
  /** Only used when adding an item; editing never changes the count. */
  quantity: z.number({ error: "Enter a number" }).pipe(quantitySchema),
});
export type StockItemFormValues = z.infer<typeof stockItemFormSchema>;

/** "Receive stock": a delivery of at least one unit, within the limit. */
export function makeReceiveStockSchema(currentQuantity: number) {
  return z.object({
    received: z
      .number({ error: "Enter a number" })
      .int("Whole units only")
      .min(1, "At least 1")
      .refine(
        (n) => currentQuantity + n <= LIMITS.quantity,
        `Stock cannot exceed ${LIMITS.quantity.toLocaleString("en-NG")} units`,
      ),
  });
}

export const STOCK_SORTS = [
  "name",
  "category",
  "quantity",
  "unitPrice",
  "value",
] as const;
export type StockSort = (typeof STOCK_SORTS)[number];

export type StockFilter = {
  q: string;
  category: string | null;
  lowOnly: boolean;
  sort: StockSort;
  dir: "asc" | "desc";
};

export const stockValueKobo = (
  s: Pick<StockItemData, "quantity" | "unitPriceKobo">,
) => s.quantity * s.unitPriceKobo;

/** Search, filter and sort the stock list. Pure, so it is unit tested. */
export function queryStock(
  items: readonly StockItem[],
  f: StockFilter,
): StockItem[] {
  const q = f.q.trim().toLowerCase();
  const key = (s: StockItem): string | number => {
    switch (f.sort) {
      case "name":
        return s.name.toLowerCase();
      case "category":
        return s.category.toLowerCase();
      case "quantity":
        return s.quantity;
      case "unitPrice":
        return s.unitPriceKobo;
      case "value":
        return stockValueKobo(s);
    }
  };
  return items
    .filter(
      (s) =>
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q),
    )
    .filter((s) => !f.category || s.category === f.category)
    .filter((s) => !f.lowOnly || isLowStock(s))
    .sort((a, b) => {
      const ka = key(a);
      const kb = key(b);
      const c =
        typeof ka === "number" && typeof kb === "number"
          ? ka - kb
          : String(ka).localeCompare(String(kb)) ||
            a.name.localeCompare(b.name);
      return f.dir === "asc" ? c : -c;
    });
}
