import { describe, expect, it } from "vitest";
import { chunkWrites, MAX_BATCH_WRITES } from "./batches";

describe("chunkWrites", () => {
  it("keeps every write, in order, within the batch limit", () => {
    const ops = Array.from({ length: 1201 }, (_, i) => i);
    const chunks = chunkWrites(ops);
    expect(chunks.map((c) => c.length)).toEqual([500, 500, 201]);
    expect(chunks.flat()).toEqual(ops);
    expect(Math.max(...chunks.map((c) => c.length))).toBeLessThanOrEqual(
      MAX_BATCH_WRITES,
    );
  });

  it("returns no chunks for no writes", () => {
    expect(chunkWrites([])).toEqual([]);
  });
});
