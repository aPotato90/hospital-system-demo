import {
  BanknoteIcon,
  CalendarClockIcon,
  ClipboardListIcon,
  FlaskConicalIcon,
  PillIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "lucide-react";
import { AUTHOR_NAME, HOSPITAL_NAME, PRODUCT_NAME } from "@/components/brand";
import { ExploreButton } from "@/components/explore-button";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { portfolioUrl } from "@/lib/firebase/config";

const FEATURES = [
  {
    icon: UsersIcon,
    title: "Reception",
    text: "Register patients, search and sort the register, and keep profiles up to date.",
  },
  {
    icon: CalendarClockIcon,
    title: "Appointments",
    text: "Day and week views with filters, booking, check-in, no-show and cancellation.",
  },
  {
    icon: ClipboardListIcon,
    title: "Consultations",
    text: "Doctors work through checked-in patients and record notes and orders.",
  },
  {
    icon: FlaskConicalIcon,
    title: "Laboratory",
    text: "Lab orders move from requested to collected to resulted.",
  },
  {
    icon: PillIcon,
    title: "Pharmacy",
    text: "Dispense prescriptions against stock with reorder levels.",
  },
  {
    icon: BanknoteIcon,
    title: "Billing",
    text: "Invoices in naira with part payments by cash, card or transfer.",
  },
];

const PREVIEW_ROWS = [
  {
    time: "09:00",
    name: "Adaeze Okafor",
    dept: "General Practice",
    status: "Checked in",
    tone: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  },
  {
    time: "09:30",
    name: "Tunde Bello",
    dept: "Paediatrics",
    status: "In consultation",
    tone: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
  },
  {
    time: "10:00",
    name: "Zainab Musa",
    dept: "Obstetrics",
    status: "Scheduled",
    tone: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  },
  {
    time: "10:30",
    name: "Emeka Eze",
    dept: "General Practice",
    status: "Completed",
    tone: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  },
];

/** Decorative preview of the appointment board (all names are invented). */
function ProductPreview() {
  return (
    <div aria-hidden="true" className="relative hidden lg:block">
      <div className="absolute -inset-4 -z-10 rounded-3xl bg-primary/10 blur-2xl" />
      <div className="rounded-2xl border bg-card p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <p className="font-semibold">Today&apos;s appointments</p>
          <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
            Receptionist view
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
          {[
            ["Booked", "24"],
            ["Waiting", "3"],
            ["Outstanding", "₦86,500"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-muted/60 p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 font-semibold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
        <ul className="mt-4 space-y-2">
          {PREVIEW_ROWS.map((r) => (
            <li
              key={r.time}
              className="flex items-center gap-3 rounded-lg border p-2.5 text-sm"
            >
              <span className="w-12 font-semibold tabular-nums">{r.time}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{r.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {r.dept}
                </span>
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.tone}`}
              >
                {r.status}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Fake data · illustration
        </p>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-14 pb-12 sm:pt-20 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="text-sm font-semibold tracking-wide text-primary uppercase">
              Portfolio demo · {HOSPITAL_NAME}
            </p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              {PRODUCT_NAME}
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-pretty text-muted-foreground">
              A hospital management product walkthrough: front desk, clinic,
              lab, pharmacy and billing in one place. Every visitor gets a
              private sandbox filled with invented patients and staff.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
              <ExploreButton />
            </div>
            <div className="mt-8 flex max-w-2xl items-start gap-3 rounded-xl border bg-card p-4 text-sm">
              <ShieldCheckIcon
                className="mt-0.5 size-5 shrink-0 text-primary"
                aria-hidden="true"
              />
              <p>
                <strong className="font-semibold">Fake data only.</strong> All
                patients, staff, phone numbers and addresses are invented.
                Please do not enter real personal or medical information. Your
                sandbox is deleted when you sign out.
              </p>
            </div>
          </div>
          <ProductPreview />
        </section>

        <section
          aria-labelledby="features-heading"
          className="mx-auto max-w-6xl px-4 pb-16"
        >
          <h2 id="features-heading" className="text-xl font-semibold">
            What you can try
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="rounded-xl border bg-card p-5">
                <Icon className="size-5 text-primary" aria-hidden="true" />
                <h3 className="mt-3 font-medium">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{text}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-muted-foreground">
            Switch between six staff roles to see how each one uses the system.
            Reception screens are live in this version; the other roles&apos;
            screens arrive in the next step.
          </p>
        </section>

        <section className="border-t">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-10 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-lg font-medium">Built by {AUTHOR_NAME}</p>
            {portfolioUrl && (
              <a
                href={portfolioUrl}
                rel="noopener"
                className="rounded-md font-medium text-primary underline underline-offset-4 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                View the portfolio
              </a>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
