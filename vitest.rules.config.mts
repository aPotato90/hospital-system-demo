import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Firestore security rules tests. Run with `npm run test:rules`, which starts
// the local Firestore emulator around this suite.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/rules/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
