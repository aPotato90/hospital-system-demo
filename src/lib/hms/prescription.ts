import { z } from "zod";
import { idSchema, nameSchema, quantitySchema, type WithId } from "./common";
import { PRESCRIPTION_STATUSES } from "./transitions";

export const prescriptionStatusSchema = z.enum(PRESCRIPTION_STATUSES);

/** Stored document under users/{uid}/prescriptions/{prescriptionId}. */
export const prescriptionSchema = z
  .object({
    consultationId: idSchema,
    patientId: idSchema,
    stockItemId: idSchema,
    name: nameSchema,
    quantity: quantitySchema.min(1),
    status: prescriptionStatusSchema,
    dispensedAt: z.date().nullable(),
  })
  .refine(
    (p) => (p.status === "dispensed") === (p.dispensedAt !== null),
    "Only dispensed prescriptions carry a dispensed time",
  );
export type PrescriptionData = z.infer<typeof prescriptionSchema>;
export type Prescription = WithId<PrescriptionData>;
