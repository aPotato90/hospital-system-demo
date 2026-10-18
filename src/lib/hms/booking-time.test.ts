import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  combineDateTime,
  FUTURE_TIME_MESSAGE,
  isBookableTime,
  makeBookAppointmentFormSchema,
  MIN_BOOKING_LEAD_MINUTES,
} from "./appointment";
import { localIsoDate } from "./common";
import { patientFormSchema } from "./patient";

/** Run a test body with the process in a given IANA time zone. */
const originalTz = process.env.TZ;
function inTimeZone(tz: string) {
  beforeEach(() => {
    process.env.TZ = tz;
  });
  afterEach(() => {
    process.env.TZ = originalTz;
    vi.useRealTimers();
  });
}

const form = {
  patientId: "pat-001",
  department: "General Practice",
  doctorId: "stf-03",
  reason: "Routine check",
} as const;

// 09:00 UTC on 18 Oct 2026 = 10:00 in Lagos (UTC+1) = 05:00 in New York (UTC-4).
const NOW = new Date("2026-10-18T09:00:00Z");

describe("isBookableTime in Africa/Lagos (UTC+1)", () => {
  inTimeZone("Africa/Lagos");

  it("reads date and time as Lagos wall-clock time", () => {
    expect(combineDateTime("2026-10-18", "10:00").toISOString()).toBe(
      "2026-10-18T09:00:00.000Z",
    );
  });

  it("rejects the past and the present", () => {
    expect(isBookableTime("2026-10-17", "16:00", NOW)).toBe(false);
    expect(isBookableTime("2026-10-18", "09:00", NOW)).toBe(false);
    expect(isBookableTime("2026-10-18", "10:00", NOW)).toBe(false);
  });

  it(`allows times from ${MIN_BOOKING_LEAD_MINUTES} minutes ahead, inclusive`, () => {
    expect(MIN_BOOKING_LEAD_MINUTES).toBe(5);
    expect(isBookableTime("2026-10-18", "10:04", NOW)).toBe(false);
    expect(isBookableTime("2026-10-18", "10:05", NOW)).toBe(true);
    expect(isBookableTime("2026-10-18", "10:06", NOW)).toBe(true);
    expect(isBookableTime("2026-10-19", "08:00", NOW)).toBe(true);
  });

  it("handles the Lagos day starting an hour before the UTC day", () => {
    // 23:30 UTC on the 18th is 00:30 on the 19th in Lagos.
    const lateNight = new Date("2026-10-18T23:30:00Z");
    expect(isBookableTime("2026-10-19", "00:30", lateNight)).toBe(false);
    expect(isBookableTime("2026-10-19", "08:00", lateNight)).toBe(true);
    expect(localIsoDate(lateNight)).toBe("2026-10-19");
    expect(lateNight.toISOString().slice(0, 10)).toBe("2026-10-18");
  });
});

describe("isBookableTime in other time zones", () => {
  describe("UTC", () => {
    inTimeZone("UTC");
    it("uses UTC wall-clock time", () => {
      expect(isBookableTime("2026-10-18", "09:04", NOW)).toBe(false);
      expect(isBookableTime("2026-10-18", "09:05", NOW)).toBe(true);
    });
  });

  describe("America/New_York (UTC-4 in October)", () => {
    inTimeZone("America/New_York");
    it("uses New York wall-clock time", () => {
      expect(isBookableTime("2026-10-18", "05:04", NOW)).toBe(false);
      expect(isBookableTime("2026-10-18", "05:05", NOW)).toBe(true);
      // 10:00 is in the past in Lagos but hours ahead in New York.
      expect(isBookableTime("2026-10-18", "10:00", NOW)).toBe(true);
    });
  });
});

describe("booking schema future rule", () => {
  inTimeZone("Africa/Lagos");

  it("reports one message on both date and time", () => {
    const schema = makeBookAppointmentFormSchema(() => NOW);
    const result = schema.safeParse({
      ...form,
      date: "2026-10-18",
      time: "09:30",
    });
    expect(result.success).toBe(false);
    const future = result.error!.issues.filter(
      (i) => i.message === FUTURE_TIME_MESSAGE,
    );
    expect(future.map((i) => i.path[0]).sort()).toEqual(["date", "time"]);
    expect(FUTURE_TIME_MESSAGE).toBe("Choose a time in the future");
  });

  it("passes once either field moves the appointment into the future", () => {
    const schema = makeBookAppointmentFormSchema(() => NOW);
    expect(
      schema.safeParse({ ...form, date: "2026-10-18", time: "10:15" }).success,
    ).toBe(true);
    expect(
      schema.safeParse({ ...form, date: "2026-10-19", time: "09:30" }).success,
    ).toBe(true);
  });

  it("still runs while other fields are empty", () => {
    const schema = makeBookAppointmentFormSchema(() => NOW);
    const result = schema.safeParse({
      ...form,
      patientId: "",
      doctorId: "",
      reason: "",
      date: "2026-10-18",
      time: "09:30",
    });
    const paths = result
      .error!.issues.filter((i) => i.message === FUTURE_TIME_MESSAGE)
      .map((i) => i.path[0]);
    expect(paths.sort()).toEqual(["date", "time"]);
  });

  it("is skipped while date or time is malformed (their own error shows)", () => {
    const schema = makeBookAppointmentFormSchema(() => NOW);
    const result = schema.safeParse({ ...form, date: "2026-10-18", time: "" });
    const messages = result.error!.issues.map((i) => i.message);
    expect(messages).toContain("Choose a time");
    expect(messages).not.toContain(FUTURE_TIME_MESSAGE);
  });

  it("reads now at validation time, not when the schema is created", () => {
    let current = new Date("2026-10-18T09:00:00Z"); // 10:00 Lagos
    const schema = makeBookAppointmentFormSchema(() => current);
    const at1015 = { ...form, date: "2026-10-18", time: "10:15" };
    expect(schema.safeParse(at1015).success).toBe(true);
    current = new Date("2026-10-18T09:30:00Z"); // 10:30 Lagos
    expect(schema.safeParse(at1015).success).toBe(false);
  });

  it("the default schema uses the real clock at each validation", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const schema = makeBookAppointmentFormSchema();
    const at1015 = { ...form, date: "2026-10-18", time: "10:15" };
    expect(schema.safeParse(at1015).success).toBe(true);
    vi.setSystemTime(new Date("2026-10-18T09:20:00Z")); // 10:20 Lagos
    expect(schema.safeParse(at1015).success).toBe(false);
  });
});

describe("patient date of birth uses the local date", () => {
  inTimeZone("Africa/Lagos");

  const patient = {
    firstName: "Ada",
    lastName: "Demo",
    sex: "female",
    phone: "+234 800 555 0101",
    address: "1 Mango Avenue, Riverside Demo Estate, Lagos",
    nextOfKin: { name: "Obi Demo", phone: "+234 800 555 0102" },
    allergies: "None known",
  } as const;

  it("accepts today's Lagos date just after midnight (still yesterday in UTC)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-18T23:30:00Z")); // 00:30 on the 19th
    expect(
      patientFormSchema.safeParse({ ...patient, dateOfBirth: "2026-10-19" })
        .success,
    ).toBe(true);
    expect(
      patientFormSchema.safeParse({ ...patient, dateOfBirth: "2026-10-20" })
        .success,
    ).toBe(false);
  });
});
