import { differenceInYears, format } from "date-fns";
import type { Staff } from "@/lib/hms/staff";

export const formatDate = (d: Date) => format(d, "d MMM yyyy");
export const formatTime = (d: Date) => format(d, "HH:mm");
export const formatDateTime = (d: Date) => format(d, "d MMM yyyy, HH:mm");

/** Parse a stored YYYY-MM-DD date as a local calendar date. */
export function parseIsoDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toIsoDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function ageFrom(dateOfBirth: string, now = new Date()): number {
  return differenceInYears(now, parseIsoDate(dateOfBirth));
}

/** "34 y" for adults, "7 y" for children, "5 mo" under one year. */
export function formatAge(dateOfBirth: string, now = new Date()): string {
  const dob = parseIsoDate(dateOfBirth);
  const years = differenceInYears(now, dob);
  if (years >= 1) return `${years} y`;
  const months =
    (now.getFullYear() - dob.getFullYear()) * 12 +
    now.getMonth() -
    dob.getMonth();
  return `${Math.max(0, months)} mo`;
}

export function staffDisplayName(
  staff: Pick<Staff, "name" | "role"> | undefined,
) {
  if (!staff) return "Unknown";
  return staff.role === "doctor" ? `Dr. ${staff.name}` : staff.name;
}
