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
