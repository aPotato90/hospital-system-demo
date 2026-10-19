import { describe, expect, it } from "vitest";
import { JOURNEY_STEPS, journeyProgress } from "./journey";

const seededAt = new Date("2026-10-18T09:00:00Z");
const at = (iso: string) => new Date(iso);

describe("journeyProgress", () => {
  it("counts only steps done since the last seed", () => {
    const p = journeyProgress(
      [
        { action: "patient.register", at: at("2026-10-17T12:00:00Z") }, // before a reset
        { action: "appointment.book", at: at("2026-10-18T09:05:00Z") },
        { action: "seed", at: seededAt },
      ],
      seededAt,
    );
    expect(p.steps.map((s) => s.done)).toEqual([
      false,
      true,
      false,
      false,
      false,
      false,
    ]);
    expect(p.completed).toBe(1);
    expect(p.next?.key).toBe("register");
  });

  it("is complete after the whole journey", () => {
    const entries = JOURNEY_STEPS.map((s) => ({
      action: s.actions[0],
      at: at("2026-10-18T10:00:00Z"),
    }));
    const p = journeyProgress(entries, seededAt);
    expect(p.completed).toBe(6);
    expect(p.next).toBeNull();
  });

  it("names a role and screen for every step", () => {
    expect(JOURNEY_STEPS.map((s) => [s.role, s.href])).toEqual([
      ["receptionist", "/app/patients"],
      ["receptionist", "/app/appointments"],
      ["doctor", "/app/consultations"],
      ["lab", "/app/lab"],
      ["pharmacist", "/app/pharmacy"],
      ["cashier", "/app/billing"],
    ]);
  });
});
