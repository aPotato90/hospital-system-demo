# Demo Hospital Manager

A hospital management system **demo** for the fictional **Riverside Demo
General Hospital**, built by Emmanuel Kelvin as a portfolio project.

> **Demo. Fake data only. Do not enter real personal or medical information.**
>
> Every patient, staff member, phone number, address and record in this app is
> invented. It gives no medical advice, provides no clinical decision support,
> and makes no claim to meet any healthcare, privacy or data-protection
> regulation.

![Admin dashboard with KPIs and charts](docs/screenshots/desktop-light-dashboard.png)

<!-- Regenerate the screenshots with
     SCREENSHOTS=1 npm run test:e2e -- e2e/screenshots.spec.ts -->

| Doctor: consultation                                             | Pharmacy: dispensing queue                               | Billing: invoice and receipt                          |
| ---------------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------- |
| ![Consultation](docs/screenshots/desktop-light-consultation.png) | ![Pharmacy](docs/screenshots/desktop-light-pharmacy.png) | ![Invoice](docs/screenshots/desktop-dark-invoice.png) |

## What it demonstrates

- **A product-quality front end**: Next.js App Router, TypeScript (strict),
  Tailwind CSS v4 and shadcn/ui; mobile first; light, dark and system themes
  with no flash on load.
- **Per-visitor sandboxes**: "Explore the demo" signs the visitor in
  anonymously with Firebase Auth. Their data lives under `users/{uid}/...` in
  Firestore, is seeded on first entry, updates in real time, and is deleted
  when they sign out.
- **Security rules with tests**: `firestore.rules` denies everything outside
  the visitor's own sandbox, validates every field (types, lengths, ranges,
  no unknown fields) and only allows sensible status changes. An emulator test
  suite checks every allowed and denied transition, cross-user access, and
  worst-case documents against Firestore's 1000-expression evaluation limit.
- **Typed data layer**: one Zod schema per entity, typed repository helpers
  (Timestamps become Dates, documents are validated on read) and real-time
  hooks with loading, error and retry states.
- **Reception workflows**: patient register with search, sorting
  and paging kept in the URL; registration and editing with React Hook Form
  and Zod; patient detail with visits, invoices and allergies; a safe delete
  that shows exactly what will be removed and offers Undo; an appointment book
  with day and week views, filters, booking, check-in, no-show and
  cancellation.
- **Doctor**: "My queue" of today's appointments for a chosen demo doctor,
  checked-in patients first. The consultation screen shows the patient's
  allergies prominently, their visit history and earlier results, and a form
  for notes, diagnosis, up to 10 prescriptions and up to 10 lab requests.
  Saving is one batched write: the consultation, pending prescriptions,
  requested lab orders, the completed appointment and an invoice (consultation
  fee per department plus lab and pharmacy lines). A visit can be edited until
  something is dispensed, resulted or paid; after that it is read-only. There
  is no clinical decision support: everything is typed by hand.
- **Lab**: a queue by status with filters by test and date and a patient
  search; mark a sample collected, enter a free-text result and mark it
  resulted. Results show on the consultation and patient pages. Resulted
  orders are read-only, except for an Admin "Undo result" that is logged.
- **Pharmacy**: a dispensing queue that shows stock on hand and an allergy
  flag (a plain text match, labelled as a demo helper, not a safety check).
  Dispensing decrements stock in the same batched write and is refused when
  stock is short. A stock list with search, category filter, sortable
  columns, low-stock highlighting (text and icon), add/edit, receive stock and
  delete with Undo.
- **Billing**: invoices with a status filter, patient search and totals; an
  invoice view with lines grouped by kind, payment history and a demo "Record
  payment" dialog (cash, card or transfer, never more than the balance); and a
  printable receipt with its own print stylesheet and the demo disclaimer.
- **Admin dashboard**: KPIs (patients, today's appointments by status,
  revenue this month, outstanding balance, low stock, pending lab orders),
  four Recharts charts themed for light and dark with a data table behind
  each, an activity feed and a filterable, read-only audit log. Every create,
  status change, dispense, payment and delete writes an audit entry.
- **A "Demo journey" panel** on the overview: six steps from registration to
  payment, each switching to the right role and opening its screen, with
  progress read from the audit log. It can be dismissed.
- **A role switcher** (Receptionist, Doctor, Lab, Pharmacist, Cashier, Admin)
  that changes the navigation. It is a UI demonstration, not real
  authorisation: anyone can switch to any role. A screen outside the current
  role explains which role it is for and offers a switch.
- **Money in naira**, stored as integer kobo and formatted with
  `Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" })`.
- **Accessibility work**: semantic landmarks, skip link, keyboard support,
  visible focus, focus moved to the page heading on navigation, AA contrast,
  `prefers-reduced-motion`. Every page and dialog is checked with axe-core.

## Stack

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind
CSS v4 · shadcn/ui (Radix) · Firebase JS SDK (Auth + Firestore, client only) ·
Zod · React Hook Form · date-fns · Recharts ·
Vitest · Playwright + axe-core · Prettier · npm.

There is no server code, no Firebase Admin SDK and no service account. The
only configuration is public: the `NEXT_PUBLIC_FIREBASE_*` web config,
`NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_PORTFOLIO_URL`.

## Set up a Firebase project

1. In the [Firebase console](https://console.firebase.google.com/), create a
   project.
2. **Authentication** > Sign-in method: enable **Anonymous**.
3. **Firestore Database**: create a database (production mode is fine; the
   rules below replace the defaults).
4. **Project settings** > Your apps: add a **Web app** and copy its config
   values.
5. **Firestore Database** > Rules: paste the full contents of
   [`firestore.rules`](firestore.rules) and click **Publish**. This repo never
   deploys rules for you.
6. Optional: **Authentication** > Settings > Authorised domains: add the domain
   you deploy to.

The rules allow only the signed-in visitor to read and write their own
`users/{uid}/...` documents. Dispensing a prescription must decrement the
stock item by exactly the dispensed quantity in the same batch, and an
invoice payment can never exceed the balance. **When `firestore.rules`
changes, paste the new version into the console and publish it again.** Payments on an invoice are appended one at a time
and only changed parts of a document are re-checked, which keeps the largest
allowed documents inside Firestore's rule-evaluation budget; the comments in
the rules file explain each choice.

## Environment variables

Copy `.env.example` to `.env.local` and fill it in:

| Variable                                   | Purpose                                       |
| ------------------------------------------ | --------------------------------------------- |
| `NEXT_PUBLIC_FIREBASE_API_KEY`             | Web app config                                |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`         | Web app config                                |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`          | Web app config                                |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`      | Web app config                                |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Web app config                                |
| `NEXT_PUBLIC_FIREBASE_APP_ID`              | Web app config                                |
| `NEXT_PUBLIC_SITE_URL`                     | Canonical site URL for metadata               |
| `NEXT_PUBLIC_PORTFOLIO_URL`                | "Built by" portfolio link (hidden when empty) |
| `NEXT_PUBLIC_FIREBASE_USE_EMULATORS`       | `true` to use the local emulators             |

The Firebase web config is a set of public identifiers, not secrets; the
security rules protect the data. Never put a service account or any other
secret in this file. Only `.env.example` is committed.

Without the Firebase values the site still builds and shows a "Firebase is not
configured" screen instead of the app.

## Run locally

Requires Node.js 20.9+ (22 recommended) and, for the emulators, Java 11+.

```bash
npm install
cp .env.example .env.local   # fill in your Firebase web config
npm run dev                  # http://localhost:3000
```

### Emulator mode (no Firebase project needed)

```bash
npm run emulators            # Auth on :9099, Firestore on :8080
```

In another terminal, set `NEXT_PUBLIC_FIREBASE_USE_EMULATORS=true` in
`.env.local` (any non-empty placeholder values work for the other
`NEXT_PUBLIC_FIREBASE_*` variables, with `NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-hms`)
and run `npm run dev`.

## Quality checks

```bash
npm run lint           # ESLint (Next.js + TypeScript rules)
npm run format:check   # Prettier
npm test               # Vitest unit tests: schemas, seed data, planners, tables
npm run test:rules     # Firestore rules tests against the emulator
npm run build          # production build
npm run test:e2e       # Playwright against the emulators (see below)
```

`npm run test:e2e` builds the app into `.next-e2e` with emulator settings,
starts the Auth and Firestore emulators, and runs the browser suite at 375,
768 and 1280 px in light and dark themes: sign-in and seeding, role switching,
registering and editing patients, search and URL state, safe delete with Undo,
booking and status changes, the whole patient journey across every role
(register, book, check in, consult, lab result, dispense, pay, dashboard
totals) in the Africa/Lagos time zone, reset, sign out (checked against the
emulator),
persistence after reload, keyboard focus, no horizontal overflow, no console
errors, and an axe-core audit of every page and dialog. Install a browser
first with `npx playwright install chromium`, or point
`PLAYWRIGHT_CHROMIUM_PATH` at an existing Chromium.

## Demo journey

1. **Receptionist**: register a patient (Patients > Register patient).
2. **Receptionist**: book them for later today and check them in
   (Appointments).
3. **Doctor**: open "My queue", start the consultation, add a prescription and
   a lab request, then "Save and complete visit". An invoice is created.
4. **Lab**: mark the sample collected, then enter the result.
5. **Pharmacist**: dispense the prescription; the stock count drops.
6. **Cashier**: open the invoice and record the payment; print the receipt.
7. **Admin**: the dashboard KPIs, charts and activity feed reflect it all.

The overview's "Demo journey" panel walks through the same steps and switches
role for you.

## Project layout

```
firestore.rules            Security rules (paste into the console)
src/app/                   Routes: landing, about, /app/*
src/components/            UI: app shell, patients, appointments, doctor, lab,
                           pharmacy, billing, admin, theme, shadcn/ui
src/lib/firebase/          Client init, config flag, AuthProvider
src/lib/hms/               Schemas, types, repo helpers, hooks, seed, actions,
                           planners (consultation, dispense, billing), metrics
tests/rules/               Firestore rules tests (emulator)
e2e/                       Playwright + axe-core browser tests
```

## Data and privacy in the demo

Each visitor's sandbox is private to their anonymous session. Signing out
deletes the sandbox (best effort). The demo audit trail is append-only by
design, so its entries remain; you can clear old anonymous users and their
leftover entries from the Firebase console at any time.
