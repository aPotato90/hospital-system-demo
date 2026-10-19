import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  collection,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { generateSeedData } from "../../src/lib/hms/seed-generator";
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_TRANSITIONS,
  canTransition,
  INVOICE_STATUSES,
  INVOICE_TRANSITIONS,
  LAB_ORDER_STATUSES,
  LAB_ORDER_TRANSITIONS,
  PRESCRIPTION_STATUSES,
  PRESCRIPTION_TRANSITIONS,
  type InvoiceStatus,
} from "../../src/lib/hms/transitions";
import * as f from "./fixtures";
import { ALICE, anonDb, BOB, createTestEnv, dbAs } from "./setup";

let env: RulesTestEnvironment;
let alice: Firestore;

beforeAll(async () => {
  env = await createTestEnv();
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  alice = dbAs(env, ALICE);
});

const path = (uid: string, ...segments: string[]) =>
  ["users", uid, ...segments].join("/");

/** Write a document directly, bypassing the rules (test setup only). */
async function seedDoc(docPath: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore() as unknown as Firestore, docPath), data);
  });
}

describe("ownership", () => {
  it("lets a user read and write their own sandbox", async () => {
    const ref = doc(alice, path(ALICE, "patients", "pat-001"));
    await assertSucceeds(setDoc(ref, f.patient()));
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(getDocs(collection(alice, path(ALICE, "patients"))));
    await assertSucceeds(deleteDoc(ref));
  });

  it("denies other users any access to the sandbox", async () => {
    await seedDoc(path(ALICE, "patients", "pat-001"), f.patient());
    const bob = dbAs(env, BOB);
    await assertFails(getDoc(doc(bob, path(ALICE, "patients", "pat-001"))));
    await assertFails(getDocs(collection(bob, path(ALICE, "patients"))));
    await assertFails(
      setDoc(doc(bob, path(ALICE, "patients", "pat-002")), f.patient()),
    );
    await assertFails(deleteDoc(doc(bob, path(ALICE, "patients", "pat-001"))));
    await assertFails(getDoc(doc(bob, path(ALICE, "meta", "state"))));
  });

  it("denies signed-out visitors", async () => {
    await seedDoc(path(ALICE, "patients", "pat-001"), f.patient());
    const anon = anonDb(env);
    await assertFails(getDoc(doc(anon, path(ALICE, "patients", "pat-001"))));
    await assertFails(
      setDoc(doc(anon, path(ALICE, "patients", "pat-002")), f.patient()),
    );
  });

  it("denies everything outside users/{uid}/known collections", async () => {
    await assertFails(setDoc(doc(alice, "patients/pat-001"), f.patient()));
    await assertFails(setDoc(doc(alice, `users/${ALICE}`), { name: "x" }));
    await assertFails(getDoc(doc(alice, `users/${ALICE}`)));
    await assertFails(
      setDoc(doc(alice, path(ALICE, "secrets", "x")), { a: 1 }),
    );
    await assertFails(
      setDoc(doc(alice, path(ALICE, "meta", "other")), f.metaState()),
    );
    await assertFails(getDocs(collection(alice, "users")));
  });
});

describe("field validation", () => {
  const cases: [string, string, () => Record<string, unknown>][] = [
    ["patients", "pat-001", f.patient],
    ["staff", "stf-01", f.staff],
    ["appointments", "apt-001", () => f.appointment()],
    ["consultations", "con-001", () => f.consultation()],
    ["labTests", "tst-01", f.labTest],
    ["labOrders", "lab-001", () => f.labOrder()],
    ["stockItems", "stk-01", f.stockItem],
    ["prescriptions", "rx-001", () => f.prescription()],
    ["invoices", "inv-001", () => f.invoice()],
    ["meta", "state", f.metaState],
  ];

  it.each(cases)("%s: accepts a valid document", async (name, id, make) => {
    await assertSucceeds(setDoc(doc(alice, path(ALICE, name, id)), make()));
  });

  it.each(cases)("%s: rejects unknown fields", async (name, id, make) => {
    await assertFails(
      setDoc(doc(alice, path(ALICE, name, id)), { ...make(), extra: true }),
    );
  });

  it.each(cases)("%s: rejects missing fields", async (name, id, make) => {
    const data = make();
    delete data[Object.keys(data)[0]];
    await assertFails(setDoc(doc(alice, path(ALICE, name, id)), data));
  });

  it("checks name, text and phone lengths", async () => {
    const ref = doc(alice, path(ALICE, "patients", "pat-001"));
    await assertSucceeds(
      setDoc(ref, { ...f.patient(), firstName: "x".repeat(120) }),
    );
    await assertFails(
      setDoc(ref, { ...f.patient(), firstName: "x".repeat(121) }),
    );
    await assertFails(setDoc(ref, { ...f.patient(), firstName: "" }));
    await assertFails(
      setDoc(ref, { ...f.patient(), allergies: "x".repeat(301) }),
    );
    await assertFails(setDoc(ref, { ...f.patient(), phone: "not a phone" }));
    await assertFails(setDoc(ref, { ...f.patient(), patientNo: "123" }));
    await assertFails(
      setDoc(ref, { ...f.patient(), dateOfBirth: "12/04/1990" }),
    );
    await assertFails(setDoc(ref, { ...f.patient(), sex: "unknown" }));
    await assertFails(
      setDoc(ref, {
        ...f.patient(),
        nextOfKin: { name: "A", phone: "1234567", x: 1 },
      }),
    );

    const con = doc(alice, path(ALICE, "consultations", "con-001"));
    await assertSucceeds(
      setDoc(con, { ...f.consultation(), notes: "x".repeat(2000) }),
    );
    await assertFails(
      setDoc(con, { ...f.consultation(), notes: "x".repeat(2001) }),
    );
  });

  it("checks kobo and quantity ranges and integer types", async () => {
    const ref = doc(alice, path(ALICE, "stockItems", "stk-01"));
    await assertSucceeds(
      setDoc(ref, {
        ...f.stockItem(),
        unitPriceKobo: 100_000_000_000,
        quantity: 100_000,
      }),
    );
    await assertSucceeds(
      setDoc(doc(alice, path(ALICE, "stockItems", "stk-02")), {
        ...f.stockItem(),
        unitPriceKobo: 0,
        quantity: 0,
      }),
    );
    await assertFails(
      setDoc(ref, { ...f.stockItem(), unitPriceKobo: 100_000_000_001 }),
    );
    await assertFails(setDoc(ref, { ...f.stockItem(), unitPriceKobo: -1 }));
    await assertFails(setDoc(ref, { ...f.stockItem(), unitPriceKobo: 20.5 }));
    await assertFails(setDoc(ref, { ...f.stockItem(), unitPriceKobo: "2000" }));
    await assertFails(setDoc(ref, { ...f.stockItem(), quantity: 100_001 }));
    await assertFails(setDoc(ref, { ...f.stockItem(), quantity: 1.5 }));
  });

  it("only accepts example.com staff emails", async () => {
    const ref = doc(alice, path(ALICE, "staff", "stf-01"));
    await assertFails(
      setDoc(ref, { ...f.staff(), email: "someone@mail.test" }),
    );
    await assertFails(setDoc(ref, { ...f.staff(), role: "superuser" }));
    await assertFails(setDoc(ref, { ...f.staff(), department: "Surgery" }));
  });

  it("only books clinical departments", async () => {
    const ref = doc(alice, path(ALICE, "appointments", "apt-001"));
    await assertFails(
      setDoc(ref, { ...f.appointment(), department: "Pharmacy" }),
    );
    await assertFails(
      setDoc(ref, { ...f.appointment(), status: "teleported" }),
    );
  });

  it("keeps lab results and dispensed times consistent with status", async () => {
    const lab = doc(alice, path(ALICE, "labOrders", "lab-001"));
    await assertFails(
      setDoc(lab, { ...f.labOrder("requested"), resultText: "early" }),
    );
    await assertFails(
      setDoc(lab, { ...f.labOrder("resulted"), resultText: "" }),
    );
    await assertFails(
      setDoc(lab, { ...f.labOrder("resulted"), resultedAt: null }),
    );
    const rx = doc(alice, path(ALICE, "prescriptions", "rx-001"));
    await assertFails(
      setDoc(rx, { ...f.prescription("pending"), dispensedAt: new Date() }),
    );
    await assertFails(
      setDoc(rx, { ...f.prescription("dispensed"), dispensedAt: null }),
    );
    await assertFails(setDoc(rx, { ...f.prescription(), quantity: 0 }));
  });

  it("keeps patient numbers immutable", async () => {
    const ref = doc(alice, path(ALICE, "patients", "pat-001"));
    await seedDoc(ref.path, f.patient());
    await assertSucceeds(updateDoc(ref, { phone: "+234 800 555 0199" }));
    await assertFails(updateDoc(ref, { patientNo: "RDH-000999" }));
  });

  it("keeps consultation ownership fields immutable", async () => {
    const ref = doc(alice, path(ALICE, "consultations", "con-001"));
    await seedDoc(ref.path, f.consultation());
    await assertSucceeds(updateDoc(ref, { notes: "Updated demo note" }));
    await assertFails(updateDoc(ref, { patientId: "pat-999" }));
    await assertFails(updateDoc(ref, { createdAt: new Date() }));
  });
});

describe("stock counts", () => {
  const ref = () => doc(alice, path(ALICE, "stockItems", "stk-01"));
  beforeEach(async () => {
    await seedDoc(ref().path, { ...f.stockItem(), quantity: 100 });
  });

  it("receives stock as a quantity-only write", async () => {
    await assertSucceeds(updateDoc(ref(), { quantity: 160 }));
    await assertFails(updateDoc(ref(), { quantity: 100_001 }));
  });

  it("edits details only while the count stays the same", async () => {
    await assertSucceeds(
      updateDoc(ref(), { unitPriceKobo: 2_500, reorderLevel: 30 }),
    );
    await assertFails(updateDoc(ref(), { unitPriceKobo: 3_000, quantity: 90 }));
  });

  it("never goes below zero", async () => {
    await assertFails(updateDoc(ref(), { quantity: -1 }));
  });
});

describe("invoice totals", () => {
  const ref = () => doc(alice, path(ALICE, "invoices", "inv-001"));

  // The line total itself is checked by the app schema (see firestore.rules).
  it("rejects paid amounts and statuses that do not match the payments", async () => {
    await assertFails(
      setDoc(ref(), { ...f.invoice([5_000]), paidKobo: 4_000 }),
    );
    await assertFails(
      setDoc(ref(), { ...f.invoice([5_000]), status: "unpaid" }),
    );
    await assertFails(setDoc(ref(), { ...f.invoice([5_000]), status: "paid" }));
    await assertFails(setDoc(ref(), f.invoice([20_000])));
    await assertFails(
      setDoc(ref(), {
        ...f.invoice(),
        lines: [],
        totalKobo: 0,
        status: "paid",
      }),
    );
    await assertFails(
      setDoc(ref(), {
        ...f.invoice(),
        lines: [{ ...f.invoiceLine(), kind: "surgery" }],
      }),
    );
    await assertFails(
      setDoc(ref(), {
        ...f.invoice([5_000]),
        payments: [{ ...f.payment(5_000), method: "crypto" }],
      }),
    );
  });

  it("makes payments append-only", async () => {
    await seedDoc(ref().path, f.invoice([3_000]));
    // Changing an earlier payment is denied even when the totals still add up.
    await assertFails(updateDoc(ref(), { ...f.invoice([4_000]) }));
    await assertFails(updateDoc(ref(), { ...f.invoice([]) }));
    await assertSucceeds(updateDoc(ref(), { ...f.invoice([3_000, 2_000]) }));
  });

  it("freezes lines once money has been taken", async () => {
    await seedDoc(ref().path, f.invoice([]));
    await assertSucceeds(updateDoc(ref(), { ...f.invoice([], 2) }));
    await assertSucceeds(updateDoc(ref(), { ...f.invoice([1_000], 2) }));
    await assertFails(updateDoc(ref(), { ...f.invoice([1_000], 3) }));
  });

  it("keeps who and when immutable", async () => {
    await seedDoc(ref().path, f.invoice([]));
    await assertFails(updateDoc(ref(), { patientId: "pat-999" }));
    await assertFails(updateDoc(ref(), { createdAt: new Date() }));
  });
});

describe("status transitions", () => {
  describe("appointments", () => {
    const pairs = APPOINTMENT_STATUSES.flatMap((from) =>
      APPOINTMENT_STATUSES.map((to) => [from, to] as const),
    );

    it.each(pairs)("%s -> %s", async (from, to) => {
      const ref = doc(alice, path(ALICE, "appointments", "apt-001"));
      await seedDoc(ref.path, f.appointment(from));
      const write = updateDoc(ref, { status: to });
      if (canTransition(APPOINTMENT_TRANSITIONS, from, to))
        await assertSucceeds(write);
      else await assertFails(write);
    });

    it("only allows status to change in a status move", async () => {
      const ref = doc(alice, path(ALICE, "appointments", "apt-001"));
      await seedDoc(ref.path, f.appointment("scheduled"));
      await assertFails(
        updateDoc(ref, { status: "checked-in", reason: "Changed" }),
      );
    });

    it("allows editing details only while scheduled", async () => {
      const ref = doc(alice, path(ALICE, "appointments", "apt-001"));
      await seedDoc(ref.path, f.appointment("scheduled"));
      await assertSucceeds(
        updateDoc(ref, {
          reason: "Rescheduled check",
          scheduledAt: new Date(),
        }),
      );
      await assertFails(updateDoc(ref, { patientId: "pat-002" }));
      await seedDoc(ref.path, f.appointment("completed"));
      await assertFails(updateDoc(ref, { reason: "Rewritten history" }));
    });
  });

  describe("lab orders", () => {
    const pairs = LAB_ORDER_STATUSES.flatMap((from) =>
      LAB_ORDER_STATUSES.map((to) => [from, to] as const),
    );

    it.each(pairs)("%s -> %s", async (from, to) => {
      const ref = doc(alice, path(ALICE, "labOrders", "lab-001"));
      await seedDoc(ref.path, f.labOrder(from));
      const next =
        to === "resulted" && from !== "resulted"
          ? {
              status: to,
              resultText: "Demo result",
              resultedAt: serverTimestamp(),
            }
          : {
              status: to,
              resultText: f.labOrder(to).resultText,
              resultedAt: f.labOrder(to).resultedAt,
            };
      const write = updateDoc(ref, next);
      if (canTransition(LAB_ORDER_TRANSITIONS, from, to))
        await assertSucceeds(write);
      else await assertFails(write);
    });

    it("stamps results with the server time and never edits them in place", async () => {
      const ref = doc(alice, path(ALICE, "labOrders", "lab-001"));
      await seedDoc(ref.path, f.labOrder("collected"));
      await assertFails(
        updateDoc(ref, {
          status: "resulted",
          resultText: "x",
          resultedAt: new Date("2020-01-01"),
        }),
      );
      await assertFails(
        updateDoc(ref, {
          status: "resulted",
          priceKobo: 1,
          resultText: "x",
          resultedAt: serverTimestamp(),
        }),
      );
      await seedDoc(ref.path, f.labOrder("resulted"));
      await assertFails(
        updateDoc(ref, { resultText: "Edited after the fact" }),
      );
      // The Admin undo goes back to collected and must clear the result.
      await assertFails(updateDoc(ref, { status: "collected" }));
      await assertSucceeds(
        updateDoc(ref, {
          status: "collected",
          resultText: "",
          resultedAt: null,
        }),
      );
    });
  });

  describe("prescriptions", () => {
    const pairs = PRESCRIPTION_STATUSES.flatMap((from) =>
      PRESCRIPTION_STATUSES.map((to) => [from, to] as const),
    );

    it.each(pairs)("%s -> %s", async (from, to) => {
      const ref = doc(alice, path(ALICE, "prescriptions", "rx-001"));
      const stock = doc(alice, path(ALICE, "stockItems", "stk-01"));
      await seedDoc(ref.path, f.prescription(from));
      await seedDoc(stock.path, { ...f.stockItem(), quantity: 50 });
      // A real dispense also takes the quantity off the stock item.
      const batch = writeBatch(alice);
      if (from === to) batch.update(ref, { status: to });
      else {
        batch.update(ref, {
          status: to,
          dispensedAt: to === "dispensed" ? serverTimestamp() : null,
        });
        batch.update(stock, { quantity: 50 - f.prescription().quantity });
      }
      const write = batch.commit();
      if (canTransition(PRESCRIPTION_TRANSITIONS, from, to))
        await assertSucceeds(write);
      else await assertFails(write);
    });

    describe("dispensing with the stock decrement", () => {
      const rx = () => doc(alice, path(ALICE, "prescriptions", "rx-001"));
      const stock = () => doc(alice, path(ALICE, "stockItems", "stk-01"));
      const dispense = (stockQuantity: number | null) => {
        const batch = writeBatch(alice);
        batch.update(rx(), {
          status: "dispensed",
          dispensedAt: serverTimestamp(),
        });
        if (stockQuantity !== null)
          batch.update(stock(), { quantity: stockQuantity });
        return batch.commit();
      };
      beforeEach(async () => {
        await seedDoc(rx().path, f.prescription("pending")); // quantity 10
        await seedDoc(stock().path, { ...f.stockItem(), quantity: 25 });
      });

      it("takes exactly the prescribed quantity", async () => {
        await assertSucceeds(dispense(15));
      });
      it("refuses a dispense that leaves stock untouched", async () => {
        await assertFails(dispense(null));
      });
      it("refuses the wrong decrement", async () => {
        await assertFails(dispense(16));
        await assertFails(dispense(5));
      });
      it("refuses dispensing more than is on hand", async () => {
        await seedDoc(stock().path, { ...f.stockItem(), quantity: 6 });
        await assertFails(dispense(-4));
      });
      it("refuses when the stock item is missing", async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
          await deleteDoc(
            doc(ctx.firestore() as unknown as Firestore, stock().path),
          );
        });
        await assertFails(dispense(null));
      });
    });

    it("stamps dispensing with the server time", async () => {
      const ref = doc(alice, path(ALICE, "prescriptions", "rx-001"));
      await seedDoc(ref.path, f.prescription("pending"));
      await assertFails(
        updateDoc(ref, {
          status: "dispensed",
          dispensedAt: new Date("2020-01-01"),
        }),
      );
      await assertFails(updateDoc(ref, { quantity: 99 }));
    });
  });

  describe("invoices", () => {
    // Payments that put a 10,000 kobo invoice in each status.
    const canonical: Record<InvoiceStatus, number[]> = {
      unpaid: [],
      "part-paid": [5_000],
      paid: [10_000],
    };
    // Forward moves append one payment; backward moves have to rewrite or
    // drop earlier payments.
    function paymentsAfter(from: InvoiceStatus, to: InvoiceStatus): number[] {
      const before = canonical[from];
      const paid = before.reduce((a, b) => a + b, 0);
      if (from !== "paid" && to === "paid") return [...before, 10_000 - paid];
      if (from !== "paid" && to === "part-paid") return [...before, 1_000];
      if (from === to) return before;
      return canonical[to];
    }
    const pairs = INVOICE_STATUSES.flatMap((from) =>
      INVOICE_STATUSES.map((to) => [from, to] as const),
    );

    it.each(pairs)("%s -> %s", async (from, to) => {
      const ref = doc(alice, path(ALICE, "invoices", "inv-001"));
      await seedDoc(ref.path, f.invoice(canonical[from]));
      const after = f.invoice(paymentsAfter(from, to));
      expect(after.status).toBe(to);
      const write = setDoc(ref, after);
      if (canTransition(INVOICE_TRANSITIONS, from, to))
        await assertSucceeds(write);
      else await assertFails(write);
    });
  });
});

describe("audit log", () => {
  const entry = () => ({
    actorRole: "receptionist",
    action: "patient.register",
    entityType: "patient",
    entityId: "pat-001",
    at: serverTimestamp(),
  });

  it("is create-only with the server time", async () => {
    const ref = doc(alice, path(ALICE, "auditLog", "log-1"));
    await assertSucceeds(setDoc(ref, entry()));
    await assertSucceeds(getDoc(ref));
    await assertFails(updateDoc(ref, { action: "patient.delete" }));
    await assertFails(setDoc(ref, entry()));
    await assertFails(deleteDoc(ref));
  });

  it("rejects back-dated or malformed entries", async () => {
    const ref = doc(alice, path(ALICE, "auditLog", "log-2"));
    await assertFails(setDoc(ref, { ...entry(), at: new Date("2020-01-01") }));
    await assertFails(setDoc(ref, { ...entry(), actorRole: "superuser" }));
    await assertFails(setDoc(ref, { ...entry(), entityType: "spaceship" }));
    await assertFails(setDoc(ref, { ...entry(), action: "DROP TABLE" }));
    await assertFails(setDoc(ref, { ...entry(), extra: 1 }));
  });

  it("cannot be written in another user's sandbox", async () => {
    const bob = dbAs(env, BOB);
    await assertFails(
      setDoc(doc(bob, path(ALICE, "auditLog", "log-3")), entry()),
    );
  });
});

describe("worst-case documents stay under the evaluation limit", () => {
  const fivek = (n: number) => Array.from({ length: n }, () => 5_000);

  it("new invoice with the maximum lines and a payment", async () => {
    const ref = doc(alice, path(ALICE, "invoices", "inv-max"));
    await assertSucceeds(setDoc(ref, f.invoice([5_000], 10)));
  });

  it("appending the last payment to an invoice with the maximum lines", async () => {
    const ref = doc(alice, path(ALICE, "invoices", "inv-max"));
    // 10 lines of 10,000 kobo; 19 payments of 5,000 kobo, then the 20th.
    await seedDoc(ref.path, f.invoice(fivek(19), 10));
    const full = f.invoice(fivek(20), 10);
    expect(full.status).toBe("paid");
    await assertSucceeds(setDoc(ref, full));
  });

  it("replacing all lines of an unpaid invoice with the maximum lines", async () => {
    const ref = doc(alice, path(ALICE, "invoices", "inv-max"));
    await seedDoc(ref.path, f.invoice([], 1));
    const next = f.invoice([], 10);
    next.lines = next.lines.map((l, i) => ({
      ...l,
      description: `Line ${i}`.padEnd(120, "x"),
    }));
    await assertSucceeds(setDoc(ref, next));
  });

  it("rejects invoices over the caps", async () => {
    await assertFails(
      setDoc(doc(alice, path(ALICE, "invoices", "inv-a")), f.invoice([], 11)),
    );
    const ref = doc(alice, path(ALICE, "invoices", "inv-b"));
    await seedDoc(ref.path, {
      ...f.invoice(fivek(20), 11),
      lines: f.invoice([], 10).lines.concat(f.invoice([], 1).lines),
      totalKobo: 110_000,
      paidKobo: 100_000,
      status: "part-paid",
    });
    await assertFails(setDoc(ref, { ...f.invoice(fivek(21), 11) }));
  });

  it("takes payments one at a time", async () => {
    await assertFails(
      setDoc(
        doc(alice, path(ALICE, "invoices", "inv-c")),
        f.invoice([2_000, 3_000]),
      ),
    );
    const ref = doc(alice, path(ALICE, "invoices", "inv-d"));
    await seedDoc(ref.path, f.invoice([2_000]));
    await assertFails(setDoc(ref, f.invoice([2_000, 3_000, 1_000])));
  });

  it("consultation with the maximum prescriptions and lab requests", async () => {
    const ref = doc(alice, path(ALICE, "consultations", "con-max"));
    const full = f.consultation(10, 10);
    full.prescriptions = full.prescriptions.map((p) => ({
      ...p,
      stockItemId: p.stockItemId.padEnd(128, "x"),
      name: p.name.padEnd(120, "x"),
      dose: p.dose.padEnd(300, "x"),
    }));
    await assertSucceeds(setDoc(ref, full));
    await assertSucceeds(
      updateDoc(ref, { notes: "x".repeat(2000), diagnosis: "y".repeat(2000) }),
    );
    // Changing both arrays re-checks every element.
    const changed = f.consultation(10, 10);
    await assertSucceeds(setDoc(ref, { ...changed, notes: "Changed" }));
    await assertFails(
      setDoc(
        doc(alice, path(ALICE, "consultations", "c2")),
        f.consultation(11, 0),
      ),
    );
    await assertFails(
      setDoc(
        doc(alice, path(ALICE, "consultations", "c3")),
        f.consultation(0, 11),
      ),
    );
  });

  it("a full consultation save batch at the caps", async () => {
    // What the doctor's "Save and complete" writes at the maximum: the
    // consultation (10 + 10), ten prescriptions, ten lab orders, the invoice
    // (folded to three lines) and the appointment, all in one batch.
    const appt = doc(alice, path(ALICE, "appointments", "apt-001"));
    await seedDoc(appt.path, f.appointment("in-consultation"));
    const batch = writeBatch(alice);
    const con = f.consultation(10, 10);
    batch.set(doc(alice, path(ALICE, "consultations", "con-max")), con);
    for (let i = 0; i < 10; i++) {
      batch.set(doc(alice, path(ALICE, "prescriptions", `rx-${i}`)), {
        ...f.prescription("pending"),
        consultationId: "con-max",
        stockItemId: `stk-${i}`,
      });
      batch.set(doc(alice, path(ALICE, "labOrders", `lab-${i}`)), {
        ...f.labOrder("requested"),
        consultationId: "con-max",
        testId: `tst-${i}`,
      });
    }
    batch.set(doc(alice, path(ALICE, "invoices", "inv-max")), {
      ...f.invoice([], 3),
      consultationId: "con-max",
    });
    batch.update(appt, { status: "completed" });
    await assertSucceeds(batch.commit());
  });

  it("checks every element, including the last one", async () => {
    const con = f.consultation(10, 10);
    con.prescriptions[9] = { ...con.prescriptions[9], quantity: 0 };
    await assertFails(
      setDoc(doc(alice, path(ALICE, "consultations", "c4")), con),
    );
    const con2 = f.consultation(10, 10);
    con2.labRequests[9] = { ...con2.labRequests[9], name: "" };
    await assertFails(
      setDoc(doc(alice, path(ALICE, "consultations", "c5")), con2),
    );

    const inv = f.invoice([], 10);
    inv.lines[9] = { ...inv.lines[9], kind: "surgery" };
    await assertFails(setDoc(doc(alice, path(ALICE, "invoices", "i4")), inv));

    const ref = doc(alice, path(ALICE, "invoices", "i5"));
    await seedDoc(ref.path, f.invoice(fivek(19), 10));
    const bad = f.invoice(fivek(20), 10);
    bad.payments[19] = { ...bad.payments[19], method: "crypto" };
    await assertFails(setDoc(ref, bad));
  });
});

describe("seed data", () => {
  it("every generated document is accepted by the rules", async () => {
    const data = generateSeedData(new Date());
    const writes = Object.entries(data).flatMap(([name, docs]) =>
      (docs as { id: string }[]).map(({ id, ...rest }) => ({
        p: path(ALICE, name, id),
        rest,
      })),
    );
    for (let i = 0; i < writes.length; i += 100) {
      const batch = writeBatch(alice);
      writes
        .slice(i, i + 100)
        .forEach(({ p, rest }) => batch.set(doc(alice, p), rest));
      await assertSucceeds(batch.commit());
    }
    const meta = doc(alice, path(ALICE, "meta", "state"));
    await assertSucceeds(
      setDoc(meta, {
        seeded: true,
        seededAt: serverTimestamp(),
        activeRole: "receptionist",
      }),
    );
    await assertSucceeds(updateDoc(meta, { activeRole: "doctor" }));
    await assertFails(updateDoc(meta, { activeRole: "god-mode" }));
  });
});
