import type { Patient } from "./patient";

export const PATIENT_SORTS = ["name", "patientNo", "registered"] as const;
export type PatientSort = (typeof PATIENT_SORTS)[number];
export type SortDirection = "asc" | "desc";

export type PatientListParams = {
  q: string;
  sort: PatientSort;
  dir: SortDirection;
  page: number;
};

export const PATIENT_PAGE_SIZE = 10;

/** Read list state from URL search params, falling back to defaults. */
export function parsePatientListParams(
  params: URLSearchParams,
): PatientListParams {
  const sort = params.get("sort");
  const page = Number.parseInt(params.get("page") ?? "1", 10);
  return {
    q: (params.get("q") ?? "").slice(0, 100),
    sort: (PATIENT_SORTS as readonly string[]).includes(sort ?? "")
      ? (sort as PatientSort)
      : "name",
    dir: params.get("dir") === "desc" ? "desc" : "asc",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/** Write list state back, omitting defaults to keep URLs short. */
export function patientListSearch(params: PatientListParams): string {
  const out = new URLSearchParams();
  if (params.q) out.set("q", params.q);
  if (params.sort !== "name") out.set("sort", params.sort);
  if (params.dir !== "asc") out.set("dir", params.dir);
  if (params.page > 1) out.set("page", String(params.page));
  const s = out.toString();
  return s ? `?${s}` : "";
}

const digits = (s: string) => s.replace(/\D/g, "");
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Does the patient match a free-text search (name, patient number, phone)? */
export function matchesPatient(p: Patient, q: string): boolean {
  const terms = fold(q).trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = fold(`${p.firstName} ${p.lastName} ${p.patientNo}`);
  const phone = digits(p.phone);
  return terms.every(
    (t) =>
      haystack.includes(t) ||
      (digits(t).length >= 3 && phone.includes(digits(t))),
  );
}

function compare(a: Patient, b: Patient, sort: PatientSort): number {
  switch (sort) {
    case "patientNo":
      return a.patientNo.localeCompare(b.patientNo);
    case "registered":
      return a.registeredAt.getTime() - b.registeredAt.getTime();
    case "name":
      return (
        a.lastName.localeCompare(b.lastName, "en") ||
        a.firstName.localeCompare(b.firstName, "en")
      );
  }
}

/** Filter, sort and paginate the register. Pure, so it is unit tested. */
export function queryPatients(
  patients: readonly Patient[],
  params: PatientListParams,
  pageSize = PATIENT_PAGE_SIZE,
) {
  const filtered = patients.filter((p) => matchesPatient(p, params.q));
  const sorted = filtered.sort((a, b) => {
    const c =
      compare(a, b, params.sort) || a.patientNo.localeCompare(b.patientNo);
    return params.dir === "asc" ? c : -c;
  });
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const page = Math.min(params.page, pageCount);
  return {
    rows: sorted.slice((page - 1) * pageSize, page * pageSize),
    total: sorted.length,
    page,
    pageCount,
    from: sorted.length === 0 ? 0 : (page - 1) * pageSize + 1,
    to: Math.min(page * pageSize, sorted.length),
  };
}
