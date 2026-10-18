import { z } from "zod";
import {
  isoDateSchema,
  LIMITS,
  nameSchema,
  phoneSchema,
  shortTextSchema,
  type WithId,
} from "./common";

export const SEXES = ["female", "male"] as const;
export const sexSchema = z.enum(SEXES);
export type Sex = z.infer<typeof sexSchema>;

export const patientNoSchema = z
  .string()
  .regex(/^RDH-\d{6}$/, "Format RDH-000123");

/** Fields a receptionist fills in. Shared by the register and edit forms. */
export const patientFormSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  dateOfBirth: isoDateSchema.refine(
    (value) => value <= new Date().toISOString().slice(0, 10),
    "Date of birth cannot be in the future",
  ),
  sex: sexSchema,
  phone: phoneSchema,
  address: z
    .string()
    .trim()
    .min(1, "Required")
    .max(LIMITS.address, `At most ${LIMITS.address} characters`),
  nextOfKin: z.object({
    name: nameSchema,
    phone: phoneSchema,
  }),
  allergies: shortTextSchema,
});
export type PatientFormValues = z.infer<typeof patientFormSchema>;

/** Stored document under users/{uid}/patients/{patientId}. */
export const patientSchema = patientFormSchema.extend({
  // Stored dates are checked for shape only; the "not in the future" rule
  // applies to form input.
  dateOfBirth: isoDateSchema,
  patientNo: patientNoSchema,
  registeredAt: z.date(),
});
export type PatientData = z.infer<typeof patientSchema>;
export type Patient = WithId<PatientData>;

export function formatPatientNo(n: number): string {
  return `RDH-${String(n).padStart(6, "0")}`;
}

/** Next free patient number given the existing ones. */
export function nextPatientNo(existing: readonly string[]): string {
  const max = existing.reduce((acc, no) => {
    const n = Number(no.slice(4));
    return Number.isFinite(n) && n > acc ? n : acc;
  }, 0);
  return formatPatientNo(max + 1);
}

export function patientFullName(
  p: Pick<PatientData, "firstName" | "lastName">,
) {
  return `${p.firstName} ${p.lastName}`;
}
