import { z } from "zod";

export const ROLES = [
  "receptionist",
  "doctor",
  "lab",
  "pharmacist",
  "cashier",
  "admin",
] as const;
export type Role = (typeof ROLES)[number];
export const roleSchema = z.enum(ROLES);

export const ROLE_LABELS: Record<Role, string> = {
  receptionist: "Receptionist",
  doctor: "Doctor",
  lab: "Lab",
  pharmacist: "Pharmacist",
  cashier: "Cashier",
  admin: "Admin",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  receptionist: "Registers patients and manages the appointment book.",
  doctor: "Sees checked-in patients and records consultations.",
  lab: "Collects samples and records lab results.",
  pharmacist: "Dispenses prescriptions and watches stock levels.",
  cashier: "Raises invoices and records payments.",
  admin: "Sees every screen, the staff list and the audit trail.",
};
