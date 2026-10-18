import {
  addDays,
  format,
  isValid,
  parse,
  startOfDay,
  startOfWeek,
} from "date-fns";
import type { Appointment } from "./appointment";
import { CLINICAL_DEPARTMENTS, type ClinicalDepartment } from "./common";
import { APPOINTMENT_STATUSES, type AppointmentStatus } from "./transitions";

export type AppointmentView = "day" | "week";

export type AppointmentListParams = {
  view: AppointmentView;
  /** Anchor day, YYYY-MM-DD. */
  date: string;
  doctor: string | null;
  department: ClinicalDepartment | null;
  status: AppointmentStatus | null;
};

const iso = (d: Date) => format(d, "yyyy-MM-dd");

export function parseAppointmentParams(
  params: URLSearchParams,
  today: Date = new Date(),
): AppointmentListParams {
  const rawDate = params.get("date") ?? "";
  const parsed = parse(rawDate, "yyyy-MM-dd", today);
  const department = params.get("department");
  const status = params.get("status");
  const doctor = params.get("doctor");
  return {
    view: params.get("view") === "week" ? "week" : "day",
    date:
      /^\d{4}-\d{2}-\d{2}$/.test(rawDate) && isValid(parsed)
        ? rawDate
        : iso(today),
    doctor: doctor && doctor.length <= 128 ? doctor : null,
    department: (CLINICAL_DEPARTMENTS as readonly string[]).includes(
      department ?? "",
    )
      ? (department as ClinicalDepartment)
      : null,
    status: (APPOINTMENT_STATUSES as readonly string[]).includes(status ?? "")
      ? (status as AppointmentStatus)
      : null,
  };
}

export function appointmentSearch(
  p: AppointmentListParams,
  today: Date = new Date(),
) {
  const out = new URLSearchParams();
  if (p.view !== "day") out.set("view", p.view);
  if (p.date !== iso(today)) out.set("date", p.date);
  if (p.doctor) out.set("doctor", p.doctor);
  if (p.department) out.set("department", p.department);
  if (p.status) out.set("status", p.status);
  const s = out.toString();
  return s ? `?${s}` : "";
}

/** The [start, end) range shown: one day, or Monday to Sunday. */
export function appointmentRange(
  p: Pick<AppointmentListParams, "view" | "date">,
) {
  const day = startOfDay(parse(p.date, "yyyy-MM-dd", new Date()));
  if (p.view === "day") return { start: day, end: addDays(day, 1) };
  const start = startOfWeek(day, { weekStartsOn: 1 });
  return { start, end: addDays(start, 7) };
}

/** Move the anchor by one day or one week. */
export function shiftDate(
  p: Pick<AppointmentListParams, "view" | "date">,
  direction: 1 | -1,
) {
  const day = parse(p.date, "yyyy-MM-dd", new Date());
  return iso(addDays(day, direction * (p.view === "week" ? 7 : 1)));
}

export function filterAppointments(
  appointments: readonly Appointment[],
  p: Pick<AppointmentListParams, "doctor" | "department" | "status">,
) {
  return appointments
    .filter(
      (a) =>
        (!p.doctor || a.doctorId === p.doctor) &&
        (!p.department || a.department === p.department) &&
        (!p.status || a.status === p.status),
    )
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
}

/** Group sorted appointments by calendar day, keeping empty days in range. */
export function groupByDay(
  appointments: readonly Appointment[],
  start: Date,
  end: Date,
) {
  const groups: { day: Date; items: Appointment[] }[] = [];
  for (let d = start; d < end; d = addDays(d, 1))
    groups.push({ day: d, items: [] });
  for (const a of appointments) {
    const g = groups.find(
      (x) => startOfDay(a.scheduledAt).getTime() === x.day.getTime(),
    );
    g?.items.push(a);
  }
  return groups;
}

/** Count per status, for the summary chips. */
export function countByStatus(appointments: readonly Appointment[]) {
  const counts = Object.fromEntries(
    APPOINTMENT_STATUSES.map((s) => [s, 0]),
  ) as Record<AppointmentStatus, number>;
  for (const a of appointments) counts[a.status] += 1;
  return counts;
}
