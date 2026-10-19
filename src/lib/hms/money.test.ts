import { describe, expect, it } from "vitest";
import { formatNaira, formatNairaCompact, nairaToKobo } from "./money";

describe("money", () => {
  it("formats integer kobo as naira", () => {
    expect(formatNaira(150_000)).toBe(
      new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
      }).format(1500),
    );
    expect(formatNaira(150_000)).toMatch(/1,500\.00/);
    expect(formatNaira(5)).toMatch(/0\.05/);
    expect(formatNaira(0)).toMatch(/0\.00/);
  });

  it("converts naira to whole kobo", () => {
    expect(nairaToKobo(1500)).toBe(150_000);
    expect(nairaToKobo(0.1 + 0.2)).toBe(30);
  });

  it("formats compact naira for chart axes", () => {
    expect(formatNairaCompact(150_000_000)).toMatch(/1\.5M/);
    expect(formatNairaCompact(5_000_000)).toMatch(/₦50K$/);
    expect(formatNairaCompact(0)).toBe("₦0");
  });
});
