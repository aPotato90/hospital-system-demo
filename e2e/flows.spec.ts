import { addDays, format } from "date-fns";
import {
  choose,
  currentUid,
  emulatorDocIds,
  expect,
  expectNoHorizontalOverflow,
  expectSavedRole,
  isMobile,
  navigate,
  startDemo,
  switchRole,
  test,
} from "./fixtures";
import type { Page } from "@playwright/test";

async function registerPatient(page: Page, first: string, last: string) {
  await page.getByRole("button", { name: "Register patient" }).click();
  const dialog = page.getByRole("dialog", { name: "Register patient" });
  await dialog.getByLabel("First name").fill(first);
  await dialog.getByLabel("Last name").fill(last);
  await dialog.getByLabel("Date of birth").fill("1990-05-01");
  await dialog.getByRole("radio", { name: "male", exact: true }).click();
  await dialog.getByLabel("Phone (fake)").first().fill("+234 800 555 0999");
  await dialog
    .getByLabel("Address (fake)")
    .fill("1 Test Close, Riverside Demo Estate");
  await dialog
    .getByRole("group", { name: "Next of kin" })
    .getByLabel("Name")
    .fill(`Kin ${last}`);
  await dialog
    .getByRole("group", { name: "Next of kin" })
    .getByLabel("Phone (fake)")
    .fill("+234 800 555 0998");
  await dialog.getByRole("button", { name: "Register patient" }).click();
  await expect(page.getByText(`${first} ${last} registered`)).toBeVisible();
  await expect(dialog).toBeHidden();
}

test("sign-in, seeding, persistence after reload and role switching", async ({
  page,
}) => {
  await startDemo(page);
  await expect(
    page.getByText("Registered patients").locator(".."),
  ).toContainText("40");
  await expectNoHorizontalOverflow(page);

  await test.step("session and data survive a reload", async () => {
    await page.reload();
    await expect(
      page.getByRole("heading", { level: 1, name: /Good day, Receptionist/ }),
    ).toBeVisible();
    await expect(
      page.getByText("Registered patients").locator(".."),
    ).toContainText("40");
  });

  await test.step("switching role changes the navigation and is persisted", async () => {
    // Leaving a screen the new role does not use lands on that role's home.
    await navigate(page, "Patients");
    await switchRole(page, "Doctor");
    await page.waitForURL("**/app/consultations");
    await expect(
      page.getByRole("heading", { level: 1, name: "My queue" }),
    ).toBeVisible();
    if (isMobile(page)) {
      await page.getByRole("button", { name: "Open navigation menu" }).click();
      const sheet = page.getByRole("dialog");
      await expect(
        sheet.getByRole("link", { name: "Consultations" }),
      ).toBeVisible();
      await expect(sheet.getByRole("link", { name: "Patients" })).toHaveCount(
        0,
      );
      await page.keyboard.press("Escape");
    } else {
      const nav = page.getByRole("navigation", { name: "Main" });
      await expect(
        nav.getByRole("link", { name: "Consultations" }),
      ).toBeVisible();
      await expect(nav.getByRole("link", { name: "Patients" })).toHaveCount(0);
    }
    await expectSavedRole(page, "doctor");
    await page.reload();
    await expect(page.getByTestId("role-switcher")).toHaveText("Doctor");
  });

  await test.step("a screen outside the role explains itself and offers a switch", async () => {
    await page.goto("/app/patients");
    await expect(
      page.getByRole("heading", {
        name: "This screen is for Receptionist and Admin",
      }),
    ).toBeVisible();
    await expect(
      page
        .getByText("Patients is not part of the Doctor view")
        .filter({ visible: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Switch to Receptionist" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Patients" }),
    ).toBeVisible();
  });

  await test.step("admin sees every screen", async () => {
    await switchRole(page, "Admin");
    if (!isMobile(page)) {
      await expect(
        page.getByRole("navigation", { name: "Main" }).getByRole("link"),
      ).toHaveCount(9);
    }
  });
});

test("register, search with URL state, edit, delete and undo", async ({
  page,
}) => {
  await startDemo(page);
  await navigate(page, "Patients");
  await expect(page.getByText("Showing 1–10 of 40 patients")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await test.step("validation and the fake-data warning", async () => {
    await page.getByRole("button", { name: "Register patient" }).click();
    const dialog = page.getByRole("dialog", { name: "Register patient" });
    await expect(
      dialog.getByText("Do not enter real personal or medical information"),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Register patient" }).click();
    await expect(dialog.getByText("Required").first()).toBeVisible();
    await expect(dialog.getByLabel("First name")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await dialog.getByRole("button", { name: "Cancel" }).click();
  });

  await test.step("register a patient", async () => {
    await registerPatient(page, "Testa", "Demofield");
    await expect(page.getByText(/of 41 patients/)).toBeVisible();
  });

  await test.step("search is kept in the URL across reloads", async () => {
    await page.getByLabel("Search patients").fill("Demofield");
    await expect(page).toHaveURL(/\?q=Demofield/);
    await expect(page.getByText("Showing 1–1 of 1 patients")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Search patients")).toHaveValue("Demofield");
    await expect(page.getByText("Showing 1–1 of 1 patients")).toBeVisible();
    await page.getByLabel("Search patients").fill("");
    await expect(page).not.toHaveURL(/q=/);
  });

  await test.step("sorting and paging are kept in the URL", async () => {
    if (page.viewportSize()!.width >= 768) {
      await page.getByRole("button", { name: /^Registered/ }).click();
    } else {
      await choose(page, "Sort by", "Date registered (oldest)");
    }
    await expect(page).toHaveURL(/sort=registered/);
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByText("Showing 11–20 of 41 patients")).toBeVisible();
    await page.goBack();
    await expect(page).not.toHaveURL(/page=2/);
    await expect(page.getByText("Showing 1–10 of 41 patients")).toBeVisible();
  });

  await test.step("open, edit and delete with undo", async () => {
    await page.getByLabel("Search patients").fill("Demofield");
    await page
      .getByRole("link", { name: /Demofield/ })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Testa Demofield" }),
    ).toBeVisible();
    await expect(page.getByText("No visits yet.")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "Edit" }).click();
    const edit = page.getByRole("dialog", { name: "Edit patient" });
    await edit.getByLabel("Phone (fake)").first().fill("+234 800 555 0777");
    await edit.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Patient details saved")).toBeVisible();
    await expect(page.getByText("+234 800 555 0777")).toBeVisible();

    await page.getByRole("button", { name: "Delete" }).click();
    const confirm = page.getByRole("alertdialog", {
      name: "Delete Testa Demofield?",
    });
    await expect(confirm).toContainText("no other records");
    await confirm.getByRole("button", { name: "Delete patient" }).click();
    await page.waitForURL("**/app/patients");
    await expect(page.getByText("Testa Demofield deleted")).toBeVisible();
    await expect(page.getByText(/of 40 patients/)).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText("Testa Demofield restored")).toBeVisible();
    await expect(page.getByText(/of 41 patients/)).toBeVisible();
  });

  await test.step("patients with history list what the cascade removes", async () => {
    await page.getByLabel("Search patients").fill("");
    // A seeded patient with visits: open the first one in the list.
    const first = page.locator('a[href^="/app/patients/pat-"]:visible').first();
    await first.click();
    await expect(
      page.getByRole("heading", { name: "Visit history" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Delete" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText(/appointment|cannot be deleted yet/);
    await dialog.getByRole("button", { name: /Cancel|Close/ }).click();
  });
});

test("book appointments and move them through the allowed statuses", async ({
  page,
}) => {
  await startDemo(page);
  await navigate(page, "Appointments");
  await expect(page.getByText(/appointments ·/)).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const scheduled = () =>
    page
      .getByTestId("appointment-row")
      .filter({ has: page.getByRole("button", { name: /^Mark no-show/ }) });

  await test.step("check in", async () => {
    const before = await scheduled().count();
    expect(before).toBeGreaterThan(2);
    const row = scheduled().first();
    const label = await row
      .getByRole("button", { name: /^Check in/ })
      .getAttribute("aria-label");
    await row.getByRole("button", { name: /^Check in/ }).click();
    await expect(page.getByText(/: checked in$/)).toBeVisible();
    await expect(scheduled()).toHaveCount(before - 1);
    // A checked-in visit can still be cancelled but not marked as a no-show.
    const name = label!.replace(/^Check in: /, "");
    const checkedIn = page
      .getByTestId("appointment-row")
      .filter({ has: page.getByRole("button", { name: `Cancel: ${name}` }) });
    await expect(checkedIn.getByText("Checked in")).toBeVisible();
    await expect(
      checkedIn.getByRole("button", { name: /^Mark no-show/ }),
    ).toHaveCount(0);
  });

  await test.step("cancel after confirming", async () => {
    const before = await scheduled().count();
    await scheduled()
      .first()
      .getByRole("button", { name: /^Cancel/ })
      .click();
    const dialog = page.getByRole("alertdialog", {
      name: "Cancel this appointment?",
    });
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByText(/: cancelled$/)).toBeVisible();
    await expect(scheduled()).toHaveCount(before - 1);
  });

  await test.step("mark a no-show after confirming", async () => {
    const before = await scheduled().count();
    await scheduled()
      .first()
      .getByRole("button", { name: /^Mark no-show/ })
      .click();
    await page
      .getByRole("alertdialog", { name: "Mark as no-show?" })
      .getByRole("button", { name: "Mark no-show" })
      .click();
    await expect(page.getByText(/: no-show$/)).toBeVisible();
    await expect(scheduled()).toHaveCount(before - 1);
  });

  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");

  await test.step("book an appointment", async () => {
    await page.getByRole("button", { name: "Book appointment" }).click();
    const dialog = page.getByRole("dialog", { name: "Book appointment" });
    await expect(
      dialog.getByText("Do not enter real personal or medical information"),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Book appointment" }).click();
    await expect(dialog.getByText("Choose a patient")).toBeVisible();
    await choose(page, "Patient", /RDH-/);
    await choose(page, "Department", "Paediatrics");
    await choose(page, "Doctor", /^Dr\. /);
    await dialog.getByLabel("Date").fill(tomorrow);
    await dialog.getByLabel("Time").fill("10:15");
    await dialog.getByLabel("Reason for visit").fill("Demo booking check");
    await dialog.getByRole("button", { name: "Book appointment" }).click();
    await expect(page.getByText(/^Booked /)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`date=${tomorrow}`));
    const row = page
      .getByTestId("appointment-row")
      .filter({ hasText: "Demo booking check" });
    await expect(row).toContainText("10:15");
    await expect(row.getByText("Scheduled")).toBeVisible();
  });

  await test.step("week view and filters live in the URL", async () => {
    await page.getByRole("button", { name: "Week", exact: true }).click();
    await expect(page).toHaveURL(/view=week/);
    await expect(
      page
        .getByTestId("appointment-row")
        .filter({ hasText: "Demo booking check" }),
    ).toBeVisible();
    await choose(page, "Status", "Scheduled");
    await expect(page).toHaveURL(/status=scheduled/);
    const rows = page.getByTestId("appointment-row");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++)
      await expect(rows.nth(i)).toContainText("Scheduled");
    await page.reload();
    await expect(page.getByRole("combobox", { name: "Status" })).toHaveText(
      "Scheduled",
    );
    await expectNoHorizontalOverflow(page);
  });
});

test("reset demo data, then sign out deletes the sandbox", async ({ page }) => {
  await startDemo(page);
  await navigate(page, "Patients");
  await registerPatient(page, "Resetta", "Demofield");
  await expect(page.getByText(/of 41 patients/)).toBeVisible();

  await test.step("reset", async () => {
    await page.getByRole("button", { name: "Demo session menu" }).click();
    await page.getByRole("menuitem", { name: "Reset demo data" }).click();
    await page
      .getByRole("alertdialog", { name: "Reset demo data?" })
      .getByRole("button", { name: "Reset data" })
      .click();
    await expect(page.getByText("Demo data reset")).toBeVisible({
      timeout: 60_000,
    });
    await expect(
      page.getByText("Registered patients").locator(".."),
    ).toContainText("40");
  });

  const uid = await currentUid(page);
  expect(uid).not.toBe("");
  expect(await emulatorDocIds(uid, "patients")).toHaveLength(40);

  await test.step("sign out", async () => {
    await page.getByRole("button", { name: "Demo session menu" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await page
      .getByRole("alertdialog", { name: "Sign out and delete your sandbox?" })
      .getByRole("button", { name: "Sign out" })
      .click();
    await page.waitForURL((url) => url.pathname === "/");
    await expect(
      page.getByText("Signed out. Your demo sandbox was deleted."),
    ).toBeVisible();
    expect(await emulatorDocIds(uid, "patients")).toHaveLength(0);
    expect(await emulatorDocIds(uid, "appointments")).toHaveLength(0);
    expect(await emulatorDocIds(uid, "meta")).toHaveLength(0);
    // The append-only audit trail stays behind by design.
    expect((await emulatorDocIds(uid, "auditLog")).length).toBeGreaterThan(0);
  });

  await page.goto("/app");
  await expect(
    page.getByRole("heading", { name: "Start a demo session" }),
  ).toBeVisible();
});

test("theme choice applies before hydration and persists", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Choose theme" }).click();
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload({ waitUntil: "commit" });
  // The inline script runs while the HTML is parsed, before React hydrates.
  await page.waitForFunction(() => document.readyState !== "loading");
  expect(
    await page.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    ),
  ).toBe(true);

  await page.getByRole("button", { name: "Choose theme" }).click();
  await page.getByRole("menuitemradio", { name: "Light" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).not.toHaveClass(/dark/);

  await page.getByRole("button", { name: "Choose theme" }).click();
  await page.getByRole("menuitemradio", { name: "System" }).click();
  const prefersDark = await page.evaluate(
    () => matchMedia("(prefers-color-scheme: dark)").matches,
  );
  await expect(page.locator("html")).toHaveClass(
    prefersDark ? /dark/ : /^(?!.*dark)/,
  );
});

test("keyboard: skip link and focus moves to the page heading", async ({
  page,
}) => {
  await startDemo(page);
  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1, name: /Good day/ }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();

  await navigate(page, "Appointments");
  await expect(
    page.getByRole("heading", { level: 1, name: "Appointments" }),
  ).toBeFocused();
});
