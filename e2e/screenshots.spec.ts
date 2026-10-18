import { expect, navigate, startDemo, test } from "./fixtures";

// Opt-in: SCREENSHOTS=1 npm run test:e2e -- e2e/screenshots.spec.ts
// Writes docs/screenshots/<project>-<page>.png for the README and PRs.
test.skip(!process.env.SCREENSHOTS, "Set SCREENSHOTS=1 to capture screenshots");

test("capture screenshots", async ({ page }, info) => {
  const shot = (name: string) =>
    page.screenshot({
      path: `docs/screenshots/${info.project.name}-${name}.png`,
    });

  await page.goto("/");
  await shot("landing");
  await startDemo(page);
  await page.waitForTimeout(500);
  await shot("overview");

  await navigate(page, "Patients");
  await expect(page.getByText(/Showing 1–10/)).toBeVisible();
  await shot("patients");

  await page.getByRole("button", { name: "Register patient" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Register patient" })
    .click();
  await expect(
    page.getByRole("dialog").getByText("Required").first(),
  ).toBeVisible();
  await page.waitForTimeout(300);
  await shot("register-dialog");
  await page.keyboard.press("Escape");

  await page.locator('a[href^="/app/patients/pat-"]:visible').first().click();
  await expect(
    page.getByRole("heading", { name: "Visit history" }),
  ).toBeVisible();
  await page.waitForTimeout(500);
  await shot("patient-detail");

  await navigate(page, "Appointments");
  await expect(page.getByText(/appointments ·/)).toBeVisible();
  await shot("appointments");

  if ((page.viewportSize()?.width ?? 1280) < 1024) {
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    await page.waitForTimeout(400);
    await shot("menu");
  }
});
