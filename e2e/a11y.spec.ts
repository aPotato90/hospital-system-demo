import {
  choose,
  expect,
  expectAccessible,
  expectSavedRole,
  expectNoHorizontalOverflow,
  isMobile,
  startDemo,
  test,
} from "./fixtures";

test("public pages are accessible", async ({ page }) => {
  for (const [path, heading] of [
    ["/", "Demo Hospital Manager"],
    ["/about", "About this demo"],
    ["/app", "Start a demo session"],
  ] as const) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { level: 1, name: heading }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectAccessible(page, path);
  }
  await page.goto("/");
  await page.getByRole("button", { name: "Choose theme" }).click();
  await expectAccessible(page, "theme menu");
});

test("app pages and dialogs are accessible", async ({ page }) => {
  await startDemo(page);
  await expectAccessible(page, "overview");

  // Admin sees every screen.
  await page.getByTestId("role-switcher").click();
  await expectAccessible(page, "role switcher listbox");
  await page.getByRole("option", { name: "Admin", exact: true }).click();
  await expect(page.getByTestId("role-switcher")).toHaveText("Admin");

  const screens = [
    ["/app/patients", "Patients"],
    ["/app/appointments", "Appointments"],
    ["/app", "Admin dashboard"],
    ["/app/consultations", "My queue"],
    ["/app/lab", "Lab orders"],
    ["/app/pharmacy", "Pharmacy"],
    ["/app/pharmacy?tab=stock", "Pharmacy"],
    ["/app/billing", "Billing"],
    ["/app/staff", "Staff"],
    ["/app/audit-log", "Audit log"],
    ["/app/appointments?view=week", "Appointments"],
  ] as const;
  for (const [path, heading] of screens) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { level: 1, name: heading }),
    ).toBeVisible();
    await expect(
      page.getByRole("status", { name: "Loading" }).filter({ visible: true }),
    ).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await expectAccessible(page, path);
  }

  await test.step("patient register dialog, with errors", async () => {
    await page.goto("/app/patients");
    await page.getByRole("button", { name: "Register patient" }).click();
    const dialog = page.getByRole("dialog", { name: "Register patient" });
    await dialog.getByRole("button", { name: "Register patient" }).click();
    await expect(dialog.getByText("Required").first()).toBeVisible();
    await expectAccessible(page, "register patient dialog");
    await page.keyboard.press("Escape");
  });

  await test.step("patient detail, edit and delete dialogs", async () => {
    await page.locator('a[href^="/app/patients/pat-"]:visible').first().click();
    await expect(
      page.getByRole("heading", { name: "Visit history" }),
    ).toBeVisible();
    await expect(page.getByRole("status", { name: "Loading" })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await expectAccessible(page, "patient detail");
    await page.getByRole("button", { name: "Edit" }).click();
    await expect(
      page.getByRole("dialog", { name: "Edit patient" }),
    ).toBeVisible();
    await expectAccessible(page, "edit patient dialog");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await expectAccessible(page, "delete patient dialog");
    await page.keyboard.press("Escape");
  });

  await test.step("booking and status dialogs", async () => {
    await page.goto("/app/appointments");
    await page.getByRole("button", { name: "Book appointment" }).click();
    const dialog = page.getByRole("dialog", { name: "Book appointment" });
    await dialog.getByRole("button", { name: "Book appointment" }).click();
    await expect(dialog.getByText("Choose a patient")).toBeVisible();
    await expectAccessible(page, "book appointment dialog");
    await choose(page, "Patient", /RDH-/);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    const cancel = page
      .getByTestId("appointment-row")
      .getByRole("button", { name: /^Cancel/ })
      .first();
    if (await cancel.count()) {
      await cancel.click();
      await expect(page.getByRole("alertdialog")).toBeVisible();
      await expectAccessible(page, "cancel appointment dialog");
      await page.getByRole("button", { name: "Keep appointment" }).click();
    }
  });

  await test.step("lab result and undo dialogs", async () => {
    await page.goto("/app/lab");
    await page.getByRole("button", { name: /^Collected \(/ }).click();
    await page
      .getByRole("button", { name: /^Enter result:/ })
      .first()
      .click();
    const dialog = page.getByRole("dialog", { name: "Enter result" });
    await dialog.getByRole("button", { name: "Mark resulted" }).click();
    await expect(dialog.getByText(/Enter the result/)).toBeVisible();
    await expectAccessible(page, "lab result dialog, with errors");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /^Resulted \(/ }).click();
    await page
      .getByRole("button", { name: /^Undo result:/ })
      .first()
      .click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await expectAccessible(page, "undo result dialog");
    await page.keyboard.press("Escape");
  });

  await test.step("pharmacy queue and stock dialogs", async () => {
    await page.goto("/app/pharmacy");
    await expect(
      page.getByTestId("dispense-row").filter({ visible: true }).first(),
    ).toBeVisible();
    await expectAccessible(page, "dispensing queue");
    await page.getByRole("button", { name: "Stock", exact: true }).click();
    await page.getByRole("button", { name: "Add item" }).click();
    const add = page.getByRole("dialog", { name: "Add stock item" });
    await add.getByRole("button", { name: "Add item" }).click();
    await expect(add.getByText("Required").first()).toBeVisible();
    await expectAccessible(page, "add stock dialog, with errors");
    await page.keyboard.press("Escape");
    await expect(add).toBeHidden();
    await page
      .getByRole("button", { name: /^Receive stock:/ })
      .filter({ visible: true })
      .first()
      .click();
    await expect(
      page.getByRole("dialog", { name: "Receive stock" }),
    ).toBeVisible();
    await expectAccessible(page, "receive stock dialog");
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: /^More actions:/ })
      .filter({ visible: true })
      .first()
      .click();
    await page.getByRole("menuitem", { name: "Edit details" }).click();
    await expect(
      page.getByRole("dialog", { name: "Edit stock item" }),
    ).toBeVisible();
    await expectAccessible(page, "edit stock dialog");
    await page.keyboard.press("Escape");
  });

  await test.step("invoice detail and payment dialog", async () => {
    await page.goto("/app/billing?status=unpaid");
    await page.locator('a[href^="/app/billing/"]:visible').first().click();
    await expect(
      page.getByRole("heading", { level: 1, name: /^Invoice for / }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectAccessible(page, "invoice detail");
    await page.getByRole("button", { name: "Record payment" }).click();
    const dialog = page.getByRole("dialog", { name: "Record payment" });
    await dialog.getByLabel("Amount (₦)").fill("0");
    await dialog.getByRole("button", { name: "Record payment" }).click();
    await expect(dialog.locator('[data-slot="field-error"]')).toBeVisible();
    await expectAccessible(page, "payment dialog, with errors");
    await page.keyboard.press("Escape");
  });

  await test.step("doctor queue and consultation form", async () => {
    await page.goto("/app/consultations");
    const open = page
      .getByRole("button", { name: /^Start consultation:/ })
      .or(page.getByRole("link", { name: /^(Open|View) consultation:/ }))
      .first();
    await open.click();
    await page.waitForURL(/\/app\/consultations\/[^/]+$/);
    await expect(
      page.getByRole("heading", { name: "Visit history" }),
    ).toBeVisible();
    await expect(
      page.getByRole("status", { name: "Loading" }).filter({ visible: true }),
    ).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await expectAccessible(page, "consultation");
  });

  await test.step("session dialogs and menus", async () => {
    await page.getByRole("button", { name: "Demo session menu" }).click();
    await expectAccessible(page, "session menu");
    await page.getByRole("menuitem", { name: "Reset demo data" }).click();
    await expectAccessible(page, "reset dialog");
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("button", { name: "Demo session menu" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expectAccessible(page, "sign out dialog");
    await page.getByRole("button", { name: "Cancel" }).click();
    if (isMobile(page)) {
      await page.getByRole("button", { name: "Open navigation menu" }).click();
      await expect(
        page.getByRole("dialog", { name: "Navigation" }),
      ).toBeVisible();
      await expectAccessible(page, "navigation sheet");
      await page.keyboard.press("Escape");
    }
  });

  await test.step("role gate notice", async () => {
    await page.getByTestId("role-switcher").click();
    await page.getByRole("option", { name: "Cashier", exact: true }).click();
    await expectSavedRole(page, "cashier");
    await page.goto("/app/patients");
    await expect(
      page.getByRole("heading", { name: /^This screen is for Receptionist/ }),
    ).toBeVisible();
    await expect(
      page.getByText(/not part of the Cashier view/).filter({ visible: true }),
    ).toBeVisible();
    await expectAccessible(page, "role gate");
  });
});
