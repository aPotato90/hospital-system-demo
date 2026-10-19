import type { ClinicalDepartment } from "./common";

/**
 * Consultation fee per clinical department, in kobo (fake demo prices).
 * Used for new invoices and by the seed generator.
 */
export const CONSULTATION_FEES_KOBO: Record<ClinicalDepartment, number> = {
  "General Practice": 1_000_000,
  Paediatrics: 800_000,
  Obstetrics: 1_200_000,
};
