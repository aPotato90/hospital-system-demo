import { z } from "zod";
import {
  clinicalDepartmentSchema,
  idSchema,
  LIMITS,
  type WithId,
} from "./common";
import { APPOINTMENT_STATUSES } from "./transitions";

export const appointmentStatusSchema = z.enum(APPOINTMENT_STATUSES);

export const appointmentReasonSchema = z
  .string()
  .trim()
  .min(1, "Required")
  .max(LIMITS.shortText, `At most ${LIMITS.shortText} characters`);

/** Stored document under users/{uid}/appointments/{appointmentId}. */
export const appointmentSchema = z.object({
  patientId: idSchema,
  doctorId: idSchema,
  department: clinicalDepartmentSchema,
  scheduledAt: z.date(),
  status: appointmentStatusSchema,
  reason: appointmentReasonSchema,
});
export type AppointmentData = z.infer<typeof appointmentSchema>;
export type Appointment = WithId<AppointmentData>;

/** Clinic hours used by the booking form (local time). */
export const CLINIC_OPEN_HOUR = 8;
export const CLINIC_CLOSE_HOUR = 17;

/** Booking form: date and time come from native inputs as strings. */
export const bookAppointmentFormSchema = z.object({
  patientId: idSchema.min(1, "Choose a patient"),
  department: clinicalDepartmentSchema,
  doctorId: idSchema.min(1, "Choose a doctor"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Choose a time")
    .refine((t) => {
      const [h, m] = t.split(":").map(Number);
      const minutes = h * 60 + m;
      return (
        minutes >= CLINIC_OPEN_HOUR * 60 && minutes <= CLINIC_CLOSE_HOUR * 60
      );
    }, `Clinic hours are ${CLINIC_OPEN_HOUR}:00 to ${CLINIC_CLOSE_HOUR}:00`),
  reason: appointmentReasonSchema,
});
export type BookAppointmentFormValues = z.infer<
  typeof bookAppointmentFormSchema
>;

/** Combine the form's local date and time into a Date. */
export function combineDateTime(date: string, time: string): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  return new Date(y, mo - 1, d, h, mi, 0, 0);
}
