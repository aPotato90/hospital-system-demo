@AGENTS.md

# Demo Hospital Manager: project rules

A portfolio demo by Emmanuel Kelvin. It must look and behave like a polished
hospital management product, but it is a **demo with fake data only**.

## Demo only, fake data only

- Product name: **Demo Hospital Manager**. Fictional hospital: **Riverside Demo
  General Hospital**.
- All data is invented: fake patients, fake staff, `@example.com` emails, fake
  phone numbers and addresses. Never add real people, real contact details or
  real clinical records, including in tests, fixtures and screenshots.
- Every page shows the banner: "Demo. Fake data only. Do not enter real personal
  or medical information." (`src/components/demo-banner.tsx`, rendered by the
  root layout).
- Every form that accepts free text shows the same warning above its fields
  (`<FakeDataWarning />`).
- No medical advice and no clinical decision support (no dosing suggestions,
  interaction checks, triage scores, diagnoses suggestions or similar).
- No compliance claims: do not mention HIPAA, NDPR, NHIA, GDPR or any similar
  regime as being met. The README and About page only say what the demo
  demonstrates.
- Role switching is a UI demonstration, not access control. Say so wherever it
  is explained.

## Secrets and configuration

- Only `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_SITE_URL` and
  `NEXT_PUBLIC_PORTFOLIO_URL` are used, and they are public client values.
- No service accounts, no Firebase Admin SDK, no server secrets. Nothing secret
  is committed. Only `.env.example` is tracked; every other `.env*` is ignored.
- Firestore rules live in `firestore.rules`. Do not deploy them from here; the
  owner pastes them into the Firebase console.

## Data

- Every visitor signs in anonymously and gets a private sandbox under
  `users/{uid}/...`. Components never build Firestore paths; use the typed repo
  helpers in `src/lib/hms/repo.ts` and the hooks in `src/lib/hms/hooks.ts`.
- Types and Zod schemas live in `src/lib/hms/` (one file per entity plus
  `index.ts`). Rules in `firestore.rules` mirror the limits in
  `src/lib/hms/common.ts` and the status tables in `src/lib/hms/transitions.ts`;
  change both together (unit and rules tests check they agree).
- Money is Nigerian naira stored as **integer kobo**. Format only with
  `formatNaira()` (`Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" })`).
- Firestore Timestamps are converted to `Date` in the repo helpers.

## UI quality bar

- Accessibility: semantic HTML and landmarks, full keyboard navigation, visible
  focus, WCAG AA contrast, honour `prefers-reduced-motion`.
- Mobile first; check layouts at 375, 768 and 1280 px with no horizontal
  overflow.
- Light, dark and system theme with no flash on load (inline script in the root
  layout, see `src/components/theme/`).

## Next.js 16 notes

- Read `node_modules/next/dist/docs/` before using an API you are unsure about
  (see AGENTS.md). `cacheComponents` and `partialPrefetching` are on.
- Client hooks that read URL data (`useSearchParams`, `useParams`) must sit
  inside a `<Suspense>` boundary.
- The `/app` segment is gated by client-side auth, so its layout exports
  `instant = false`.

## Definition of done

Run all of these and make sure they pass before declaring a task done:

```bash
npm run lint
npm run format:check
npm test
npm run test:rules   # starts the Firestore emulator
npm run build
```

`npm run test:e2e` runs the browser suite against the Auth and Firestore
emulators at 375/768/1280 px in both themes, with axe-core checks.
