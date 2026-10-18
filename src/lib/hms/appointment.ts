import { z } from "zod";
import {
  clinicalDepartmentSchema,
  idSchema,
  isoDateSchema,
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

/**
 * Bookings must start at least this many minutes from now. A small lead
 * keeps "the next slot" bookable while ruling out times that have already
 * passed (or will have by the time the receptionist presses Book).
 */
export const MIN_BOOKING_LEAD_MINUTES = 5;
export const FUTURE_TIME_MESSAGE = "Choose a time in the future";

/**
 * Can an appointment be booked for this local date and time?
 *
 * The date and time are the browser's local wall-clock values (what the
 * native inputs show), combined in the local time zone, then compared as
 * instants with `now`. `now` is read when validation runs, never cached, so
 * a dialog left open for a while still judges against the current time.
 * Allowed: from `now + MIN_BOOKING_LEAD_MINUTES` onward (inclusive).
 */
export function isBookableTime(
  date: string,
  time: string,
  now: Date = new Date(),
): boolean {
  const when = combineDateTime(date, time);
  return when.getTime() >= now.getTime() + MIN_BOOKING_LEAD_MINUTES * 60_000;
}

const bookingFieldsSchema = z.object({
  patientId: idSchema.min(1, "Choose a patient"),
  department: clinicalDepartmentSchema,
  doctorId: idSchema.min(1, "Choose a doctor"),
  date: isoDateSchema,
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

/**
 * Booking form schema. The "in the future" rule needs both date and time, so
 * it is checked on the combined value and reported on both fields (the form
 * shows it once). It runs whenever date and time are themselves valid, even
 * if other fields (patient, doctor) are still empty. `now` is injectable for
 * tests and defaults to the time of each validation.
 */
export function makeBookAppointmentFormSchema(
  now: () => Date = () => new Date(),
) {
  return bookingFieldsSchema.superRefine(
    (values, ctx) => {
      if (isBookableTime(values.date, values.time, now())) return;
      for (const path of ["date", "time"] as const) {
        ctx.addIssue({
          code: "custom",
          path: [path],
          message: FUTURE_TIME_MESSAGE,
        });
      }
    },
    {
      when: ({ issues }) =>
        !issues.some((i) => i.path?.[0] === "date" || i.path?.[0] === "time"),
    },
  );
}

/** Booking form: date and time come from native inputs as strings. */
export const bookAppointmentFormSchema = makeBookAppointmentFormSchema();
export type BookAppointmentFormValues = z.infer<
  typeof bookAppointmentFormSchema
>;
/** Combine the form's local date and time into a Date. */
export function combineDateTime(date: string, time: string): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  return new Date(y, mo - 1, d, h, mi, 0, 0);
}
