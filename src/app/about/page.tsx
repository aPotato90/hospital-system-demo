import type { Metadata } from "next";
import { AUTHOR_NAME, HOSPITAL_NAME, PRODUCT_NAME } from "@/components/brand";
import { DEMO_WARNING } from "@/components/demo-banner";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { portfolioUrl } from "@/lib/firebase/config";

export const metadata: Metadata = { title: "About this demo" };

export default function AboutPage() {
  return (
    <>
      <SiteHeader />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 outline-none"
      >
        <h1 className="text-3xl font-semibold tracking-tight">
          About this demo
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          {PRODUCT_NAME} is a portfolio project by {AUTHOR_NAME}. It shows how a
          hospital management product for the fictional {HOSPITAL_NAME} could
          look and behave.
        </p>

        <div className="mt-10 space-y-10 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:mt-2 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
          <section aria-labelledby="demonstrates">
            <h2 id="demonstrates">What it demonstrates</h2>
            <ul>
              <li>
                A Next.js App Router front end in TypeScript with Tailwind CSS
                and shadcn/ui, built mobile first with light and dark themes.
              </li>
              <li>
                Firebase anonymous sign-in and a private Firestore sandbox per
                visitor, with real-time updates.
              </li>
              <li>
                Firestore security rules that keep each sandbox private,
                validate every field and only allow sensible status changes (for
                example, an appointment can be checked in but not
                &ldquo;un-cancelled&rdquo;). The rules are covered by automated
                tests against the Firebase emulator.
              </li>
              <li>
                Forms validated with Zod and React Hook Form, money stored as
                integer kobo and shown in naira, and an append-only audit trail.
              </li>
              <li>
                Accessibility work: keyboard navigation, visible focus, skip
                link, landmarks and contrast checks.
              </li>
            </ul>
          </section>

          <section aria-labelledby="fake-data">
            <h2 id="fake-data">Fake data only</h2>
            <p>{DEMO_WARNING}</p>
            <p>
              Every patient, staff member, phone number, address and record is
              invented. Staff emails use example.com. Clinical text in the
              sample records is placeholder wording, not medical content.
            </p>
            <p>
              When you sign out, your sandbox is deleted. The demo audit trail
              is append-only by design, so its entries are not removed.
            </p>
          </section>

          <section aria-labelledby="not-a-medical-product">
            <h2 id="not-a-medical-product">Not a medical product</h2>
            <p>
              This demo gives no medical advice and provides no clinical
              decision support. It makes no claim to meet any healthcare,
              privacy or data-protection regulation and must not be used to
              store or process real patient information.
            </p>
          </section>

          <section aria-labelledby="roles">
            <h2 id="roles">About the role switcher</h2>
            <p>
              Inside the app you can switch between Receptionist, Doctor, Lab,
              Pharmacist, Cashier and Admin. Switching changes which screens
              appear in the navigation so you can see each person&apos;s view.
              It is a UI demonstration only, not access control: in this demo
              you are always the only user of your own sandbox.
            </p>
          </section>

          <section aria-labelledby="author">
            <h2 id="author">Who built it</h2>
            <p>
              Built by {AUTHOR_NAME}.
              {portfolioUrl && (
                <>
                  {" "}
                  <a
                    href={portfolioUrl}
                    rel="noopener"
                    className="font-medium text-primary underline underline-offset-4"
                  >
                    View the portfolio
                  </a>
                  .
                </>
              )}
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
