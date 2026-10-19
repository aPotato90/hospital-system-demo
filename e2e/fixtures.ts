import AxeBuilder from "@axe-core/playwright";
import { expect, test as base, type Page } from "@playwright/test";

/** Console errors and uncaught exceptions fail every test. */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
      await use(errors);
      expect(errors, "console errors").toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

export const isMobile = (page: Page) =>
  (page.viewportSize()?.width ?? 1280) < 1024;

/** Landing page -> anonymous sign-in -> seeded sandbox. */
export async function startDemo(page: Page) {
  await page.goto("/");
  await expect(page.getByText("Demo. Fake data only.").first()).toBeVisible();
  await page.getByRole("button", { name: "Explore the demo" }).click();
  await page.waitForURL("**/app");
  await expect(
    page.getByRole("heading", { level: 1, name: /Good day/ }),
  ).toBeVisible({
    timeout: 60_000,
  });
}

/** Open a screen from the sidebar or, on small screens, the menu sheet. */
export async function navigate(page: Page, label: string) {
  if (isMobile(page)) {
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    await page.getByRole("dialog").getByRole("link", { name: label }).click();
  } else {
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: label })
      .click();
  }
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
}

export async function switchRole(page: Page, label: string) {
  const trigger = page.getByTestId("role-switcher");
  // Radix can drop an option click that lands while a busy page is still
  // rendering the opened listbox, so retry until the switch sticks.
  await expect(async () => {
    if ((await trigger.getAttribute("aria-expanded")) !== "true") {
      await trigger.click();
    }
    await page.getByRole("option", { name: label, exact: true }).click();
    await expect(trigger).toHaveText(label, { timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
}

/** Pick an option in a shadcn (Radix) select by its label. */
export async function choose(
  page: Page,
  label: string | RegExp,
  option: string | RegExp,
) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option }).first().click();
}

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow, "horizontal overflow in px").toBeLessThanOrEqual(0);
}

/** axe-core WCAG 2.x A/AA audit of the current page state. */
export async function expectAccessible(page: Page, context: string) {
  // Let open/close animations settle so contrast is measured on final colours.
  await page.waitForTimeout(350);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    // The Next.js route announcer is injected by the framework.
    .exclude("next-route-announcer")
    // While a dialog, menu or listbox is open, Radix marks the rest of the
    // page aria-hidden (data-aria-hidden) and traps focus in the overlay, so
    // the background is out of reach; the overlay itself is still audited.
    .exclude('[data-aria-hidden="true"]')
    .analyze();
  const summary = results.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.map((n) => `${n.target.join(" ")}: ${n.failureSummary ?? ""}`).join("\n    ")}`,
  );
  expect(summary, `axe violations on ${context}`).toEqual([]);
}

/** Current anonymous user id, read from the app's Firebase instance. */
export async function currentUid(page: Page): Promise<string> {
  return page.evaluate(() => {
    const fb = (
      globalThis as unknown as {
        __hmsFirebase?: { auth: { currentUser: { uid: string } | null } };
      }
    ).__hmsFirebase;
    return fb?.auth.currentUser?.uid ?? "";
  });
}

/** List document ids in a sandbox collection straight from the emulator (admin view). */
export async function emulatorDocIds(
  uid: string,
  collection: string,
): Promise<string[]> {
  const host = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
  const res = await fetch(
    `http://${host}/v1/projects/demo-hms/databases/(default)/documents/users/${uid}/${collection}?pageSize=500`,
    { headers: { Authorization: "Bearer owner" } },
  );
  const body = (await res.json()) as { documents?: { name: string }[] };
  return (body.documents ?? []).map((d) => d.name.split("/").pop()!);
}

/** Wait until the sandbox's saved role (meta/state) matches. */
export async function expectSavedRole(page: Page, role: string) {
  const uid = await currentUid(page);
  const host = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
  await expect
    .poll(async () => {
      const res = await fetch(
        `http://${host}/v1/projects/demo-hms/databases/(default)/documents/users/${uid}/meta/state`,
        { headers: { Authorization: "Bearer owner" } },
      );
      const body = (await res.json()) as {
        fields?: { activeRole?: { stringValue?: string } };
      };
      return body.fields?.activeRole?.stringValue;
    })
    .toBe(role);
}

const LAGOS_OFFSET_MS = 60 * 60 * 1000; // UTC+1, no daylight saving

/**
 * The latest instant that is 10:00 in Lagos and not in the future, so "now"
 * in the page sits mid-morning (a past and a future slot exist today) and is
 * never ahead of the real clock (auth tokens stay valid).
 */
export function lagosMorning() {
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
