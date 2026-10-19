const nairaFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
});

/** Format integer kobo as naira, e.g. 150000 -> "₦1,500.00". */
export function formatNaira(kobo: number): string {
  return nairaFormatter.format(kobo / 100);
}

/** Convert a naira amount (possibly fractional) to integer kobo. */
export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}

const compactNairaFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  notation: "compact",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

/** Short naira for chart axes, e.g. 150000000 kobo -> "₦1.5M". */
export function formatNairaCompact(kobo: number): string {
  return compactNairaFormatter.format(kobo / 100);
}
