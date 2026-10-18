/** Firestore allows at most 500 writes in one batch. */
export const MAX_BATCH_WRITES = 500;

/** Split write operations into batch-sized chunks, keeping their order. */
export function chunkWrites<T>(
  ops: readonly T[],
  size = MAX_BATCH_WRITES,
): T[][] {
  if (size < 1) throw new Error("Batch size must be at least 1");
  const chunks: T[][] = [];
  for (let i = 0; i < ops.length; i += size)
    chunks.push(ops.slice(i, i + size));
  return chunks;
}
