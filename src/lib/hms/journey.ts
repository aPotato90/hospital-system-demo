import type { AuditAction, AuditLogData } from "./audit-log";
import type { Role } from "./roles";

/** The guided demo journey shown on the overview. */
export type JourneyStep = {
  key: string;
  label: string;
  role: Role;
  href: string;
  /** Audit actions that count as doing this step. */
  actions: readonly AuditAction[];
};

export const JOURNEY_STEPS: readonly JourneyStep[] = [
  {
    key: "register",
    label: "Register a patient",
    role: "receptionist",
    href: "/app/patients",
    actions: ["patient.register"],
  },
  {
    key: "book",
    label: "Book an appointment",
    role: "receptionist",
    href: "/app/appointments",
    actions: ["appointment.book"],
  },
  {
    key: "consult",
    label: "Consult",
    role: "doctor",
    href: "/app/consultations",
    actions: ["consultation.create"],
  },
  {
    key: "lab",
    label: "Lab",
    role: "lab",
    href: "/app/lab",
    actions: ["lab.result"],
  },
  {
    key: "pharmacy",
    label: "Pharmacy",
    role: "pharmacist",
    href: "/app/pharmacy",
    actions: ["rx.dispense"],
  },
  {
    key: "pay",
    label: "Pay",
    role: "cashier",
    href: "/app/billing",
    actions: ["invoice.payment"],
  },
];

/**
 * Which steps the visitor has done in this sandbox: an audit entry for the
 * step written since the sandbox was last seeded (the audit log is
 * append-only, so entries from before a reset are ignored).
 */
export function journeyProgress(
  entries: readonly Pick<AuditLogData, "action" | "at">[],
  seededAt: Date | null,
) {
  const since = seededAt?.getTime() ?? 0;
  const done = new Set(
    entries.filter((e) => e.at.getTime() >= since).map((e) => e.action),
  );
  const steps = JOURNEY_STEPS.map((step) => ({
    ...step,
    done: step.actions.some((a) => done.has(a)),
  }));
  return {
    steps,
    completed: steps.filter((s) => s.done).length,
    next: steps.find((s) => !s.done) ?? null,
  };
}
