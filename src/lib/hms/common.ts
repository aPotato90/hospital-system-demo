import { z } from "zod";

/**
 * Field limits shared by the Zod schemas and `firestore.rules`.
 * `common.test.ts` checks that the rules file uses the same numbers.
 */
export const LIMITS = {
  /** Document ids. */
  id: 128,
  /** Person, item and test names. */
  name: 120,
  /** Long free text such as consultation notes or lab results. */
  text: 2000,
  /** Short free text such as appointment reasons or allergies. */
  shortText: 300,
  /** Short labels such as stock categories and units. */
  label: 60,
  phone: 20,
  address: 200,
  /** Integer kobo: 0 to ₦1,000,000,000.00. */
  kobo: 100_000_000_000,
  /** Integer quantities. */
  quantity: 100_000,
  /** Array caps (keep worst-case rule evaluation under Firestore's limit). */
  invoiceLines: 10,
  payments: 20,
  prescriptions: 10,
  labRequests: 10,
} as const;

export const DEPARTMENTS = [
  "General Practice",
  "Paediatrics",
  "Obstetrics",
  "Laboratory",
  "Pharmacy",
] as const;
export type Department = (typeof DEPARTMENTS)[number];

/** Departments that see outpatients by appointment. */
export const CLINICAL_DEPARTMENTS = [
  "General Practice",
  "Paediatrics",
  "Obstetrics",
] as const satisfies readonly Department[];
export type ClinicalDepartment = (typeof CLINICAL_DEPARTMENTS)[number];

export const idSchema = z.string().min(1).max(LIMITS.id);

/** Required, trimmed name. */
export const nameSchema = z
  .string()
  .trim()
  .min(1, "Required")
  .max(LIMITS.name, `At most ${LIMITS.name} characters`);

export const labelSchema = z
  .string()
  .trim()
  .min(1, "Required")
  .max(LIMITS.label, `At most ${LIMITS.label} characters`);

export const textSchema = z
  .string()
  .trim()
  .max(LIMITS.text, `At most ${LIMITS.text} characters`);

export const shortTextSchema = z
  .string()
  .trim()
  .max(LIMITS.shortText, `At most ${LIMITS.shortText} characters`);

/** Loose phone format: digits, spaces, +, -, parentheses. */
export const phoneSchema = z
  .string()
  .trim()
  .min(7, "Enter a phone number")
  .max(LIMITS.phone, `At most ${LIMITS.phone} characters`)
  .regex(/^\+?[0-9 ()-]+$/, "Digits, spaces, +, - and brackets only");

export const koboSchema = z
  .number()
  .int("Whole kobo only")
  .min(0)
  .max(LIMITS.kobo);

export const quantitySchema = z
  .number()
  .int("Whole numbers only")
  .min(0)
  .max(LIMITS.quantity);

export const departmentSchema = z.enum(DEPARTMENTS);
export const clinicalDepartmentSchema = z.enum(CLINICAL_DEPARTMENTS);

/** `YYYY-MM-DD` calendar date (stored as a string to avoid time zone drift). */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
    );
  }, "Not a real date");

/** A document as returned by the repo helpers: data plus its id. */
export type WithId<T> = T & { id: string };
