import { z } from "zod";
import {
  idSchema,
  LIMITS,
  nameSchema,
  quantitySchema,
  shortTextSchema,
  textSchema,
  type WithId,
} from "./common";

export const consultationPrescriptionSchema = z.object({
  stockItemId: idSchema,
  name: nameSchema,
  /** Dose text as written by the doctor, e.g. "1 tablet twice daily". */
  dose: shortTextSchema.min(1, "Required"),
  quantity: quantitySchema.min(1),
});

export const labRequestSchema = z.object({
  testId: idSchema,
  name: nameSchema,
});

/** Stored document under users/{uid}/consultations/{consultationId}. */
export const consultationSchema = z.object({
  appointmentId: idSchema,
  patientId: idSchema,
  doctorId: idSchema,
  notes: textSchema,
  diagnosis: textSchema,
  prescriptions: z
    .array(consultationPrescriptionSchema)
    .max(LIMITS.prescriptions),
  labRequests: z.array(labRequestSchema).max(LIMITS.labRequests),
  createdAt: z.date(),
});
export type ConsultationData = z.infer<typeof consultationSchema>;
export type Consultation = WithId<ConsultationData>;
