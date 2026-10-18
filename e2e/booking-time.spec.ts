import type { Page } from "@playwright/test";
import { choose, expect, navigate, startDemo, test } from "./fixtures";

/**
 * Regression test for the booking dialog's "future time" check, from a phone
 * in Lagos (UTC+1): after a past time was rejected, choosing a valid future
 * date or time must clear the error and let the form submit.
 */
test.use({ timezoneId: "Africa/Lagos" });
test.skip(
  ({ viewport }) => viewport?.width !== 375,
  "Runs on the 375px mobile projects (light and dark)",
);

const LAGOS_OFFSET_MS = 60 * 60 * 1000; // UTC+1, no daylight saving

/**
 * The latest instant that is 10:00 in Lagos and not in the future, so "now"
 * in the page sits mid-morning (a past and a future slot exist today) and is
 * never ahead of the real clock (auth tokens stay valid).
 */
function lagosMorning() {
  const now = Date.now();
  const lagosNow = new Date(now + LAGOS_OFFSET_MS);
  let at =
    Date.UTC(
      lagosNow.getUTCFullYear(),
      lagosNow.getUTCMonth(),
      lagosNow.getUTCDate(),
      10,
    ) - LAGOS_OFFSET_MS;
  if (at > now) at -= 24 * 60 * 60 * 1000;
  const lagosDate = (offsetDays: number) =>
    new Date(at + LAGOS_OFFSET_MS + offsetDays * 86_400_000)
      .toISOString()
      .slice(0, 10);
  return {
    at: new Date(at),
    yesterday: lagosDate(-1),
    today: lagosDate(0),
    tomorrow: lagosDate(1),
  };
}

const morning = lagosMorning();
// Seeded appointments sit on :00 and :30, so these slots never clash with them.
const FUTURE_ERROR = "Choose a time in the future";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(morning.at);
});

async function openBooking(page: Page) {
  await startDemo(page);
  await navigate(page, "Appointments");
  await page.getByRole("button", { name: "Book appointment" }).click();
  const dialog = page.getByRole("dialog", { name: "Book appointment" });
  await choose(page, "Patient", /RDH-/);
  await choose(page, "Department", "General Practice");
  await choose(page, "Doctor", /^Dr\. /);
  await dialog.getByLabel("Reason for visit").fill("Time zone check");
  return dialog;
}

async function setDate(page: Page, value: string) {
  await page.getByLabel("Date", { exact: true }).fill(value);
}

async function setTime(page: Page, value: string) {
  await page.getByLabel("Time", { exact: true }).fill(value);
}

async function expectBooked(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Book appointment" });
  await expect(dialog.getByText(FUTURE_ERROR)).toBeHidden();
  const time = await page.getByLabel("Time", { exact: true }).inputValue();
  await dialog.getByRole("button", { name: "Book appointment" }).click();
  // The success toast names the booked slot (earlier toasts may still show).
  await expect(
    page.getByText(new RegExp(`^Booked .*, ${time}$`)),
  ).toBeVisible();
  await expect(dialog).toBeHidden();
}

test("past time today, then a later time today", async ({ page }) => {
  const dialog = await openBooking(page);
  await setDate(page, morning.today);
  await setTime(page, "09:15");
  await dialog.getByRole("button", { name: "Book appointment" }).click();
  await expect(dialog.getByText(FUTURE_ERROR)).toBeVisible();

  await setTime(page, "11:15");
  await expect(dialog.getByText(FUTURE_ERROR)).toBeHidden();
  await expectBooked(page);
});

test("past time today, then only the date changes", async ({ page }) => {
  const dialog = await openBooking(page);
  await setDate(page, morning.today);
  await setTime(page, "09:15");
  await dialog.getByRole("button", { name: "Book appointment" }).click();
  await expect(dialog.getByText(FUTURE_ERROR)).toBeVisible();

  await setDate(page, morning.tomorrow);
  await expect(dialog.getByText(FUTURE_ERROR)).toBeHidden();
  await expectBooked(page);
});

test("past date, then time first and date second", async ({ page }) => {
  const dialog = await openBooking(page);
  await setDate(page, morning.yesterday);
  await setTime(page, "11:15");
  await dialog.getByRole("button", { name: "Book appointment" }).click();
  await expect(dialog.getByText(FUTURE_ERROR)).toBeVisible();

  // Still in the past after the time changes...
  await setTime(page, "14:15");
  await expect(dialog.getByText(FUTURE_ERROR)).toBeVisible();
  // ...and valid once the date does.
  await setDate(page, morning.tomorrow);
  await expectBooked(page);
});

test("the error appears and clears live, before any submit", async ({
  page,
}) => {
  const dialog = await openBooking(page);
  await setDate(page, morning.today);
  await setTime(page, "11:15");
  await setTime(page, "09:45");
  await page.getByLabel("Reason for visit").focus();
  await expect(dialog.getByText(FUTURE_ERROR)).toBeVisible();
  await setTime(page, "10:00");
  // 10:00 is "now": inside the 5-minute window, so still rejected.
  await expect(dialog.getByText(FUTURE_ERROR)).toBeVisible();
  await setTime(page, "10:15");
  await expectBooked(page);
});

test("a picker that only fires change events still updates the form", async ({
  page,
}) => {
  const dialog = await openBooking(page);
  await setDate(page, morning.today);
  await setTime(page, "09:15");
  await dialog.getByRole("button", { name: "Book appointment" }).click();
  await expect(dialog.getByText(FUTURE_ERROR)).toBeVisible();

  // Some mobile pickers commit the value with a single "change" event and no
  // "input" events; set the value the way the browser does and fire only that.
  await page.getByLabel("Time", { exact: true }).evaluate((el) => {
    const input = el as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    setter.call(input, "11:45");
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(dialog.getByText(FUTURE_ERROR)).toBeHidden();
  await expectBooked(page);
});

test("a double-booking error clears when the time changes", async ({
  page,
}) => {
  await openBooking(page);
  await setDate(page, morning.tomorrow);
  await setTime(page, "11:15");
  await expectBooked(page);

  // Same patient, doctor and slot again.
  await page.getByRole("button", { name: "Book appointment" }).click();
  const dialog = page.getByRole("dialog", { name: "Book appointment" });
  await choose(page, "Patient", /RDH-/);
  await choose(page, "Department", "General Practice");
  await choose(page, "Doctor", /^Dr\. /);
  await dialog.getByLabel("Reason for visit").fill("Time zone check");
  await setDate(page, morning.tomorrow);
  await setTime(page, "11:15");
  await dialog.getByRole("button", { name: "Book appointment" }).click();
  const clash = dialog.getByText(
    "This doctor already has an appointment at that time",
  );
  await expect(clash).toBeVisible();
  await setTime(page, "11:45");
  await expect(clash).toBeHidden();
  await expectBooked(page);
});
