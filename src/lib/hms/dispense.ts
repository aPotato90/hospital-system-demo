import type { Prescription } from "./prescription";
import type { StockItem } from "./stock-item";

export type DispensePlan =
  { ok: true; newQuantity: number } | { ok: false; reason: string };

/**
 * Can this prescription be dispensed from this stock item? Dispensing takes
 * the whole prescribed quantity; there are no partial dispenses in the demo.
 * The Firestore rules enforce the same: the stock item must drop by exactly
 * the prescribed quantity and never below zero.
 */
export function planDispense(
  rx: Pick<Prescription, "status" | "quantity" | "stockItemId">,
  stock: Pick<StockItem, "id" | "quantity" | "unit"> | undefined,
): DispensePlan {
  if (rx.status !== "pending") {
    return {
      ok: false,
      reason: "This prescription has already been dispensed.",
    };
  }
  if (!stock || stock.id !== rx.stockItemId) {
    return {
      ok: false,
      reason: "The stock item for this prescription no longer exists.",
    };
  }
  if (stock.quantity < rx.quantity) {
    return {
      ok: false,
      reason: `Not enough stock: ${stock.quantity} ${stock.unit}(s) on hand, ${rx.quantity} needed. Receive stock first.`,
    };
  }
  return { ok: true, newQuantity: stock.quantity - rx.quantity };
}

const NO_ALLERGY = /^\s*(none( known)?|nil|n\/a|no known allergies)?\s*$/i;

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 4);
}

/**
 * DEMO HELPER, NOT A SAFETY CHECK. Does the patient's free-text allergy note
 * mention a word from the drug name (or the drug name mention a word from the
 * note)? A plain string match on fake data, used only to show where such a
 * flag would appear. It knows nothing about drug classes or cross-reactions.
 */
export function allergyMentionsDrug(
  allergies: string,
  drugName: string,
): boolean {
  if (NO_ALLERGY.test(allergies)) return false;
  const note = allergies.toLowerCase();
  const drug = drugName.toLowerCase();
  return (
    words(drugName).some((w) => note.includes(w)) ||
    words(allergies).some((w) => drug.includes(w))
  );
}
