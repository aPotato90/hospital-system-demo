import { z } from "zod";
import {
  koboSchema,
  labelSchema,
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
