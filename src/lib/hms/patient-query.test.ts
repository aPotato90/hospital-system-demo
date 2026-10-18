import { describe, expect, it } from "vitest";
import {
  matchesPatient,
  parsePatientListParams,
  patientListSearch,
  queryPatients,
} from "./patient-query";
import { generateSeedData } from "./seed-generator";

const patients = generateSeedData(new Date(2026, 9, 18)).patients;
const defaults = { q: "", sort: "name", dir: "asc", page: 1 } as const;

describe("URL params", () => {
  it("parses with safe defaults", () => {
    expect(parsePatientListParams(new URLSearchParams(""))).toEqual(defaults);
    expect(
      parsePatientListParams(
        new URLSearchParams("sort=bogus&dir=up&page=-3&q=ada"),
      ),
    ).toEqual({ ...defaults, q: "ada" });
    expect(
      parsePatientListParams(
        new URLSearchParams("sort=registered&dir=desc&page=3"),
      ),
    ).toEqual({ q: "", sort: "registered", dir: "desc", page: 3 });
  });

  it("round-trips and omits defaults", () => {
    expect(patientListSearch(defaults)).toBe("");
    const p = { q: "okafor", sort: "patientNo", dir: "desc", page: 2 } as const;
    expect(
      parsePatientListParams(new URLSearchParams(patientListSearch(p))),
    ).toEqual(p);
  });
});

describe("queryPatients", () => {
  it("paginates 10 per page", () => {
    const r = queryPatients(patients, defaults);
    expect(r.rows).toHaveLength(10);
    expect(r.total).toBe(40);
    expect(r.pageCount).toBe(4);
    expect([r.from, r.to]).toEqual([1, 10]);
    const last = queryPatients(patients, { ...defaults, page: 99 });
    expect(last.page).toBe(4);
    expect([last.from, last.to]).toEqual([31, 40]);
  });

  it("sorts by surname then first name, both directions", () => {
    const asc = queryPatients(patients, { ...defaults, page: 1 }, 100).rows;
    const names = asc.map((p) => `${p.lastName} ${p.firstName}`);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en")));
    const desc = queryPatients(
      patients,
      { ...defaults, dir: "desc" },
      100,
    ).rows;
    expect(desc[0].id).toBe(asc.at(-1)!.id);
  });

  it("sorts by registration date and patient number", () => {
    const byReg = queryPatients(
      patients,
      { ...defaults, sort: "registered" },
      100,
    ).rows;
    for (let i = 1; i < byReg.length; i++) {
      expect(byReg[i].registeredAt >= byReg[i - 1].registeredAt).toBe(true);
    }
    // Patient numbers follow registration order in the seed data.
    const byNo = queryPatients(
      patients,
      { ...defaults, sort: "patientNo" },
      100,
    ).rows;
    expect(byNo.map((p) => p.id)).toEqual(byReg.map((p) => p.id));
  });

  it("searches names, numbers and phone digits", () => {
    const p = patients[5];
    expect(matchesPatient(p, p.firstName.toUpperCase())).toBe(true);
    expect(matchesPatient(p, `${p.lastName} ${p.firstName}`)).toBe(true);
    expect(matchesPatient(p, p.patientNo.toLowerCase())).toBe(true);
    expect(matchesPatient(p, p.phone.slice(-4))).toBe(true);
    expect(matchesPatient(p, "zzzz-nobody")).toBe(false);
    const r = queryPatients(patients, { ...defaults, q: p.patientNo });
    expect(r.rows.map((x) => x.id)).toEqual([p.id]);
  });

  it("handles no results", () => {
    const r = queryPatients(patients, { ...defaults, q: "no such patient" });
    expect(r).toMatchObject({
      rows: [],
      total: 0,
      page: 1,
      pageCount: 1,
      from: 0,
      to: 0,
    });
  });
});
