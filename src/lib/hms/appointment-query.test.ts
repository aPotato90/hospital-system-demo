import { describe, expect, it } from "vitest";
import {
  appointmentRange,
  appointmentSearch,
  countByStatus,
  filterAppointments,
  groupByDay,
  parseAppointmentParams,
  shiftDate,
} from "./appointment-query";
import { generateSeedData } from "./seed-generator";

const today = new Date(2026, 9, 18, 10); // Sunday 18 Oct 2026
const data = generateSeedData(today);

describe("appointment URL params", () => {
  it("defaults to today's day view", () => {
    expect(parseAppointmentParams(new URLSearchParams(), today)).toEqual({
      view: "day",
      date: "2026-10-18",
      doctor: null,
      department: null,
      status: null,
    });
  });

  it("ignores invalid values", () => {
    const p = parseAppointmentParams(
      new URLSearchParams(
        "view=month&date=2026-13-45&department=Surgery&status=lost",
      ),
      today,
    );
    expect(p).toMatchObject({
      view: "day",
      date: "2026-10-18",
      department: null,
      status: null,
    });
  });

  it("round-trips and omits defaults", () => {
    const p = {
      view: "week",
      date: "2026-10-20",
      doctor: "stf-05",
      department: "Paediatrics",
      status: "scheduled",
    } as const;
    const s = appointmentSearch(p, today);
    expect(parseAppointmentParams(new URLSearchParams(s), today)).toEqual(p);
    expect(
      appointmentSearch(
        parseAppointmentParams(new URLSearchParams(), today),
        today,
      ),
    ).toBe("");
  });
});

describe("ranges", () => {
  it("covers one day or a Monday-to-Sunday week", () => {
    const day = appointmentRange({ view: "day", date: "2026-10-18" });
    expect(day.start).toEqual(new Date(2026, 9, 18));
    expect(day.end).toEqual(new Date(2026, 9, 19));
    const week = appointmentRange({ view: "week", date: "2026-10-18" });
    expect(week.start).toEqual(new Date(2026, 9, 12));
    expect(week.end).toEqual(new Date(2026, 9, 19));
  });

  it("shifts by a day or a week", () => {
    expect(shiftDate({ view: "day", date: "2026-10-31" }, 1)).toBe(
      "2026-11-01",
    );
    expect(shiftDate({ view: "week", date: "2026-10-18" }, -1)).toBe(
      "2026-10-11",
    );
  });
});

describe("filtering and grouping", () => {
  it("filters by doctor, department and status and sorts by time", () => {
    const doctor = data.appointments[0].doctorId;
    const r = filterAppointments(data.appointments, {
      doctor,
      department: null,
      status: null,
    });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((a) => a.doctorId === doctor)).toBe(true);
    for (let i = 1; i < r.length; i++)
      expect(r[i].scheduledAt >= r[i - 1].scheduledAt).toBe(true);
    const s = filterAppointments(data.appointments, {
      doctor: null,
      department: "Obstetrics",
      status: "completed",
    });
    expect(
      s.every((a) => a.department === "Obstetrics" && a.status === "completed"),
    ).toBe(true);
  });

  it("groups into every day of the range", () => {
    const { start, end } = appointmentRange({
      view: "week",
      date: "2026-10-18",
    });
    const inRange = data.appointments.filter(
      (a) => a.scheduledAt >= start && a.scheduledAt < end,
    );
    const groups = groupByDay(
      filterAppointments(inRange, {
        doctor: null,
        department: null,
        status: null,
      }),
      start,
      end,
    );
    expect(groups).toHaveLength(7);
    expect(groups.reduce((n, g) => n + g.items.length, 0)).toBe(inRange.length);
  });

  it("counts statuses", () => {
    const counts = countByStatus(data.appointments);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(
      data.appointments.length,
    );
  });
});
