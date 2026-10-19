import { describe, expect, it } from "vitest";
import { ROLES } from "@/lib/hms/roles";
import {
  homeFor,
  isPathAllowed,
  navItemForPath,
  navItemsFor,
} from "./nav-config";

describe("role navigation", () => {
  it("gives every role the overview and at least one screen of its own", () => {
    for (const role of ROLES) {
      const items = navItemsFor(role);
      expect(items[0].href).toBe("/app");
      expect(items.length).toBeGreaterThan(1);
    }
  });

  it("shows reception screens to receptionists and admins only", () => {
    expect(isPathAllowed("/app/patients", "receptionist")).toBe(true);
    expect(isPathAllowed("/app/patients/pat-001", "admin")).toBe(true);
    expect(isPathAllowed("/app/patients/pat-001", "doctor")).toBe(false);
    expect(isPathAllowed("/app/appointments", "cashier")).toBe(false);
    expect(isPathAllowed("/app", "lab")).toBe(true);
  });

  it("matches nested paths to their section", () => {
    expect(navItemForPath("/app/patients/abc")?.label).toBe("Patients");
    expect(navItemForPath("/app")?.label).toBe("Overview");
  });

  it("sends each role to its own first screen", () => {
    expect(homeFor("receptionist")).toBe("/app/patients");
    expect(homeFor("doctor")).toBe("/app/consultations");
    expect(homeFor("cashier")).toBe("/app/billing");
  });

  it("lets admins see every screen", () => {
    expect(navItemsFor("admin")).toHaveLength(9);
  });

  it("gates every clinical screen, including detail pages, to its role and Admin", () => {
    const cases: [string, string][] = [
      ["/app/consultations/apt-001", "doctor"],
      ["/app/lab?status=collected", "lab"],
      ["/app/pharmacy", "pharmacist"],
      ["/app/billing/inv-001", "cashier"],
    ];
    for (const [path, role] of cases) {
      const pathname = path.split("?")[0];
      expect(isPathAllowed(pathname, role as never)).toBe(true);
      expect(isPathAllowed(pathname, "admin")).toBe(true);
      expect(isPathAllowed(pathname, "receptionist")).toBe(false);
    }
    expect(isPathAllowed("/app/audit-log", "admin")).toBe(true);
    expect(isPathAllowed("/app/audit-log", "doctor")).toBe(false);
    expect(isPathAllowed("/app/staff", "cashier")).toBe(false);
  });
});
