import { expect, navigate, startDemo, switchRole, test } from "./fixtures";

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

  const settle = async () => {
    await expect(
      page.getByRole("status", { name: "Loading" }).filter({ visible: true }),
    ).toHaveCount(0);
    await page.waitForTimeout(500);
  };

  await switchRole(page, "Doctor");
  await page.waitForURL("**/app/consultations");
  await settle();
  await shot("queue");
  await page
    .getByRole("link", { name: /^(Open|View) consultation:/ })
    .or(page.getByRole("button", { name: /^Start consultation:/ }))
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Visit history" }),
  ).toBeVisible();
  await settle();
  await shot("consultation");

  await switchRole(page, "Lab");
  await page.waitForURL("**/app/lab");
  await settle();
  await shot("lab");

  await switchRole(page, "Pharmacist");
  await page.waitForURL("**/app/pharmacy");
  await settle();
  await shot("pharmacy");
  await page.getByRole("button", { name: "Stock", exact: true }).click();
  await settle();
  await shot("stock");

  await switchRole(page, "Cashier");
  await page.waitForURL("**/app/billing");
  await settle();
  await shot("billing");
  await page.locator('a[href^="/app/billing/"]:visible').first().click();
  await expect(
    page.getByRole("heading", { level: 1, name: /^Invoice for / }),
  ).toBeVisible();
  await settle();
  await shot("invoice");

  await switchRole(page, "Admin");
  await page.goto("/app");
  await expect(
    page.getByRole("heading", { level: 1, name: "Admin dashboard" }),
  ).toBeVisible();
  await settle();
  await shot("dashboard");
  await navigate(page, "Audit log");
  await settle();
  await shot("audit-log");

  if ((page.viewportSize()?.width ?? 1280) < 1024) {
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    await page.waitForTimeout(400);
    await shot("menu");
  }
});
