/**
 * Allowed status transitions. `firestore.rules` enforces the same tables and
 * the rules tests check every (from, to) pair against these maps.
 * Staying in the same status is always allowed (edits that keep the status).
 */

export const APPOINTMENT_STATUSES = [
  "scheduled",
  "checked-in",
  "in-consultation",
  "completed",
  "cancelled",
  "no-show",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const APPOINTMENT_TRANSITIONS: Record<
  AppointmentStatus,
  readonly AppointmentStatus[]
> = {
  scheduled: ["checked-in", "cancelled", "no-show"],
  "checked-in": ["in-consultation", "cancelled"],
  "in-consultation": ["completed"],
  completed: [],
  cancelled: [],
  "no-show": [],
};

export const LAB_ORDER_STATUSES = [
  "requested",
  "collected",
  "resulted",
] as const;
export type LabOrderStatus = (typeof LAB_ORDER_STATUSES)[number];

/**
 * resulted -> collected is the Admin "undo result" in the demo: it clears the
 * result so it can be entered again. The screen offers it to Admin only; the
 * rules cannot know the demo role, so they allow the move itself.
 */
export const LAB_ORDER_TRANSITIONS: Record<
  LabOrderStatus,
  readonly LabOrderStatus[]
> = {
  requested: ["collected"],
  collected: ["resulted"],
  resulted: ["collected"],
};

export const LAB_ORDER_STATUS_LABELS: Record<LabOrderStatus, string> = {
  requested: "Requested",
  collected: "Collected",
  resulted: "Resulted",
};

export const PRESCRIPTION_STATUSES = ["pending", "dispensed"] as const;
export type PrescriptionStatus = (typeof PRESCRIPTION_STATUSES)[number];

export const PRESCRIPTION_STATUS_LABELS: Record<PrescriptionStatus, string> = {
  pending: "Pending",
  dispensed: "Dispensed",
};

export const PRESCRIPTION_TRANSITIONS: Record<
  PrescriptionStatus,
  readonly PrescriptionStatus[]
> = {
  pending: ["dispensed"],
  dispensed: [],
};

export const INVOICE_STATUSES = ["unpaid", "part-paid", "paid"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  unpaid: "Unpaid",
  "part-paid": "Part-paid",
  paid: "Paid",
};

/** Payments only move an invoice forward. */
export const INVOICE_TRANSITIONS: Record<
  InvoiceStatus,
  readonly InvoiceStatus[]
> = {
  unpaid: ["part-paid", "paid"],
  "part-paid": ["paid"],
  paid: [],
};

export function canTransition<S extends string>(
  table: Record<S, readonly S[]>,
  from: S,
  to: S,
): boolean {
  return from === to || table[from].includes(to);
}

/** Invoice status is derived from the amounts, never chosen freely. */
export function invoiceStatusFor(
  totalKobo: number,
  paidKobo: number,
): InvoiceStatus {
  if (paidKobo >= totalKobo) return "paid";
  if (paidKobo > 0) return "part-paid";
  return "unpaid";
}

/** Receptionist actions on an appointment, in display order. */
export const RECEPTION_ACTIONS = [
  { to: "checked-in", label: "Check in" },
  { to: "no-show", label: "Mark no-show" },
  { to: "cancelled", label: "Cancel" },
] as const satisfies readonly { to: AppointmentStatus; label: string }[];

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Scheduled",
  "checked-in": "Checked in",
  "in-consultation": "In consultation",
  completed: "Completed",
  cancelled: "Cancelled",
  "no-show": "No-show",
};
