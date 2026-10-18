import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests against a production build wired to the local Auth and
 * Firestore emulators. Run with `npm run test:e2e`, which starts the
 * emulators around this suite. Placeholder Firebase values are fine in
 * emulator mode; nothing here talks to a real Firebase project.
 */
const PORT = 3100;

const emulatorEnv = {
  NEXT_DIST_DIR: ".next-e2e",
  NEXT_PUBLIC_FIREBASE_API_KEY: "demo-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-hms.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-hms",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "demo-hms.appspot.com",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "000000000000",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:000000000000:web:0000000000000000",
  NEXT_PUBLIC_FIREBASE_USE_EMULATORS: "true",
  NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
  NEXT_PUBLIC_PORTFOLIO_URL: "https://example.com/portfolio",
};

const viewports = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 900 },
} as const;

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : undefined,
  },
  projects: Object.entries(viewports).flatMap(([name, viewport]) =>
    (["light", "dark"] as const).map((colorScheme) => ({
      name: `${name}-${colorScheme}`,
      use: {
        ...devices["Desktop Chrome"],
        viewport,
        colorScheme,
        hasTouch: name === "mobile",
      },
    })),
  ),
  webServer: {
    command: `npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 300_000,
    reuseExistingServer: false,
    env: emulatorEnv,
  },
});
