import type { Page } from "@playwright/test";
import {
  choose,
  expect,
  expectAccessible,
  expectNoHorizontalOverflow,
  expectSavedRole,
  lagosMorning,
  navigate,
  startDemo,
  switchRole,
  test,
} from "./fixtures";

// Next.js keeps earlier routes in the DOM (hidden by <Activity>), so text, label
// and test-id locators filter to visible elements; role locators already do.

/**
 * The whole patient journey across every role, in the Africa/Lagos time zone
 * with the page clock at 10:00 Lagos (so an 11:15 booking today is valid):
 * register -> book -> check in -> consult (prescription + lab request) ->
 * lab result -> dispense -> pay -> the admin dashboard reflects it.
 */
test.use({ timezoneId: "Africa/Lagos" });

const morning = lagosMorning();
const FIRST = "Jordan";
const LAST = "Journeyman";
const NAME = `${FIRST} ${LAST}`;

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(morning.at);
});

async function kpi(page: Page, id: string) {
  return (
    await page.getByTestId(id).filter({ visible: true }).innerText()
  ).trim();
}

test("the full patient journey updates every screen", async ({ page }) => {
  test.setTimeout(240_000);
  await startDemo(page);

  // Baseline numbers on the admin dashboard.
  await switchRole(page, "Admin");
  await expect(
    page.getByRole("heading", { level: 1, name: "Admin dashboard" }),
  ).toBeVisible();
  await expect(
    page.getByTestId("kpi-patients").filter({ visible: true }),
  ).toHaveText("40");
  const revenueBefore = await kpi(page, "kpi-revenue");
  await expect(
    page.getByTestId("journey-count").filter({ visible: true }),
  ).toHaveText("0 of 6 done");

  await test.step("1 reception registers the patient", async () => {
    await switchRole(page, "Receptionist");
    await navigate(page, "Patients");
    await page.getByRole("button", { name: "Register patient" }).click();
    const dialog = page.getByRole("dialog", { name: "Register patient" });
    await dialog.getByLabel("First name").fill(FIRST);
    await dialog.getByLabel("Last name").fill(LAST);
    await dialog.getByLabel("Date of birth").fill("1988-02-14");
    await dialog.getByLabel("Phone (fake)").first().fill("+234 800 555 0888");
    await dialog
      .getByLabel("Address (fake)")
      .fill("8 Journey Close, Riverside Demo Estate");
    const kin = dialog.getByRole("group", { name: "Next of kin" });
    await kin.getByLabel("Name").fill("Kin Journeyman");
    await kin.getByLabel("Phone (fake)").fill("+234 800 555 0889");
    await dialog.getByLabel("Allergies").fill("None known");
    await dialog.getByRole("button", { name: "Register patient" }).click();
    await expect(
      page.getByText(`${NAME} registered`).filter({ visible: true }),
    ).toBeVisible();
  });

  await test.step("2 reception books today 11:15 and checks the patient in", async () => {
    await navigate(page, "Appointments");
    await page.getByRole("button", { name: "Book appointment" }).click();
    const dialog = page.getByRole("dialog", { name: "Book appointment" });
    await choose(page, "Patient", new RegExp(LAST));
    await choose(page, "Department", "General Practice");
    await choose(page, "Doctor", /^Dr\. /);
    await dialog.getByLabel("Date", { exact: true }).fill(morning.today);
    await dialog.getByLabel("Time", { exact: true }).fill("11:15");
    await dialog.getByLabel("Reason for visit").fill("Journey demo visit");
    await dialog.getByRole("button", { name: "Book appointment" }).click();
    await expect(
      page.getByText(new RegExp(`^Booked ${NAME}`)).filter({ visible: true }),
    ).toBeVisible();
    const row = page
      .getByTestId("appointment-row")
      .filter({ visible: true })
      .filter({ hasText: NAME });
    await row.getByRole("button", { name: /^Check in/ }).click();
    await expect(row.getByText("Checked in")).toBeVisible();
  });

  await test.step("3 the doctor consults, prescribes and requests a test", async () => {
    await switchRole(page, "Doctor");
    await page.waitForURL("**/app/consultations");
    await expect(
      page.getByRole("heading", { level: 1, name: "My queue" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    const row = page
      .getByTestId("queue-row")
      .filter({ visible: true })
      .filter({ hasText: NAME });
    await row.getByRole("button", { name: /^Start consultation/ }).click();
    await page.waitForURL(/\/app\/consultations\/[^/]+$/);
    await expect(
      page.getByRole("heading", { level: 1, name: NAME }),
    ).toBeVisible();
    await expect(
      page.getByText("not medical software").filter({ visible: true }),
    ).toBeVisible();

    await page
      .getByLabel("Diagnosis")
      .filter({ visible: true })
      .fill("Demo diagnosis for the journey");
    await page
      .getByLabel("Notes")
      .filter({ visible: true })
      .fill("Demo note. Fictional record.");
    await page.getByRole("button", { name: "Add item" }).click();
    await choose(page, "Item", /^Paracetamol 500 mg/);
    await page
      .getByLabel("Dose (as written)")
      .filter({ visible: true })
      .fill("2 tablets, demo text");
    await page.getByLabel("Quantity").filter({ visible: true }).fill("10");
    await page.getByRole("button", { name: "Add test" }).click();
    await choose(page, "Test", /^Full blood count/);
    await expectAccessible(page, "consultation form");
    await page.getByRole("button", { name: "Save and complete visit" }).click();
    await expect(
      page.getByText(/^Visit completed\. Invoice: /).filter({ visible: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Consultation record" }),
    ).toBeVisible();
    await expect(
      page.getByText("Awaiting sample.").filter({ visible: true }),
    ).toBeVisible();
  });

  await test.step("4 the lab collects the sample and records a result", async () => {
    await switchRole(page, "Lab");
    await page.waitForURL("**/app/lab");
    await page
      .getByLabel("Search patient")
      .filter({ visible: true })
      .fill(LAST);
    const requested = page
      .getByTestId("lab-row")
      .filter({ visible: true })
      .filter({ hasText: NAME });
    await requested.getByRole("button", { name: /^Mark collected/ }).click();
    await expect(
      page
        .getByText(/^Sample collected: Full blood count/)
        .filter({ visible: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^Collected/ }).click();
    const collected = page
      .getByTestId("lab-row")
      .filter({ visible: true })
      .filter({ hasText: NAME });
    await collected.getByRole("button", { name: /^Enter result/ }).click();
    const dialog = page.getByRole("dialog", { name: "Enter result" });
    await expect(
      dialog.getByText("Do not enter real personal or medical information"),
    ).toBeVisible();
    await expectAccessible(page, "lab result dialog");
    await dialog
      .getByLabel("Result")
      .fill("Demo result: made-up values for the journey.");
    await dialog.getByRole("button", { name: "Mark resulted" }).click();
    await expect(
      page
        .getByText(/^Full blood count resulted for /)
        .filter({ visible: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^Resulted/ }).click();
    await expect(
      page
        .getByTestId("lab-row")
        .filter({ visible: true })
        .filter({ hasText: NAME }),
    ).toContainText("Demo result: made-up values");
  });

  await test.step("5 the pharmacy dispenses and stock goes down", async () => {
    await switchRole(page, "Pharmacist");
    await page.waitForURL("**/app/pharmacy");
    const row = page
      .getByTestId("dispense-row")
      .filter({ visible: true })
      .filter({ hasText: NAME });
    await expect(row).toContainText("Paracetamol 500 mg × 10");
    await expect(row).toContainText("On hand: 2400 tablet(s)");
    await row.getByRole("button", { name: /^Dispense/ }).click();
    await expect(
      page
        .getByText(/^Dispensed 10 × Paracetamol 500 mg/)
        .filter({ visible: true }),
    ).toBeVisible();
    await expect(
      page
        .getByTestId("dispense-row")
        .filter({ visible: true })
        .filter({ hasText: NAME }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Stock", exact: true }).click();
    await page
      .getByLabel("Search stock")
      .filter({ visible: true })
      .fill("Paracetamol 500");
    await expect(
      page
        .getByText(/2390 tablet/)
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
  });

  let invoiceTotal = "";
  await test.step("6 the cashier records the payment", async () => {
    await switchRole(page, "Cashier");
    await page.waitForURL("**/app/billing");
    await page
      .getByLabel("Search patient")
      .filter({ visible: true })
      .fill(LAST);
    await page.locator('a[href^="/app/billing/"]:visible').first().click();
    await expect(
      page.getByRole("heading", { level: 1, name: `Invoice for ${NAME}` }),
    ).toBeVisible();
    await expect(
      page
        .getByText("This is not a real receipt or invoice.")
        .filter({ visible: true }),
    ).toBeVisible();
    invoiceTotal = (
      await page
        .getByTestId("invoice-balance")
        .filter({ visible: true })
        .innerText()
    ).trim();
    await page.getByRole("button", { name: "Record payment" }).click();
    const dialog = page.getByRole("dialog", { name: "Record payment" });
    await expect(
      dialog.getByText("Demo only: no real payment is taken."),
    ).toBeVisible();
    await expectAccessible(page, "payment dialog");
    await dialog.getByRole("button", { name: "Record payment" }).click();
    await expect(
      page.getByText(/Invoice is paid\.$/).filter({ visible: true }),
    ).toBeVisible();
    await expect(
      page.getByTestId("invoice-balance").filter({ visible: true }),
    ).toHaveText("₦0.00");
    await expectNoHorizontalOverflow(page);
  });

  await test.step("7 the admin dashboard reflects the journey", async () => {
    await switchRole(page, "Admin");
    await expectSavedRole(page, "admin");
    await page.goto("/app");
    await expect(
      page.getByRole("heading", { level: 1, name: "Admin dashboard" }),
    ).toBeVisible();
    await expect(
      page.getByTestId("kpi-patients").filter({ visible: true }),
    ).toHaveText("41");
    await expect(
      page.getByTestId("kpi-revenue").filter({ visible: true }),
    ).not.toHaveText(revenueBefore);
    const parse = (s: string) => Number(s.replace(/[^\d.]/g, ""));
    await expect
      .poll(
        async () =>
          parse(await kpi(page, "kpi-revenue")) - parse(revenueBefore),
      )
      .toBeCloseTo(parse(invoiceTotal), 2);
    await expect(
      page.getByTestId("activity-feed").filter({ visible: true }),
    ).toContainText("Recorded a payment");
    await expect(
      page.getByTestId("journey-count").filter({ visible: true }),
    ).toHaveText("6 of 6 done");
    await expectNoHorizontalOverflow(page);
  });

  await test.step("results show on the patient's record", async () => {
    await navigate(page, "Patients");
    await page
      .getByLabel("Search patients")
      .filter({ visible: true })
      .fill(LAST);
    await page
      .getByRole("link", { name: new RegExp(LAST) })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { name: "Lab results" }),
    ).toBeVisible();
    await expect(
      page
        .getByText("Demo result: made-up values for the journey.")
        .filter({ visible: true }),
    ).toBeVisible();
  });
});
