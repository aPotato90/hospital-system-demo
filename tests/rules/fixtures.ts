/** Valid documents for every sandbox collection (all fictional). */

const at = new Date("2026-10-01T09:00:00Z");

export const patient = () => ({
  patientNo: "RDH-000123",
  firstName: "Ada",
  lastName: "Demo",
  dateOfBirth: "1990-04-12",
  sex: "female",
  phone: "+234 800 555 0101",
  address: "1 Mango Avenue, Riverside Demo Estate, Lagos",
  nextOfKin: { name: "Obi Demo", phone: "+234 800 555 0102" },
  allergies: "None known",
  registeredAt: at,
});

export const staff = () => ({
  name: "Demo Doctor",
  role: "doctor",
  department: "General Practice",
  email: "demo.doctor@example.com",
});

export const appointment = (status = "scheduled") => ({
  patientId: "pat-001",
  doctorId: "stf-03",
  department: "General Practice",
  scheduledAt: at,
  status,
  reason: "Routine check",
});

export const consultationPrescription = (i = 0) => ({
  stockItemId: `stk-${i}`,
  name: `Demo drug ${i}`,
  dose: "1 tablet daily",
  quantity: 10,
});

export const labRequest = (i = 0) => ({
  testId: `tst-${i}`,
  name: `Demo test ${i}`,
});

export const consultation = (prescriptions = 1, labRequests = 1) => ({
  appointmentId: "apt-001",
  patientId: "pat-001",
  doctorId: "stf-03",
  notes: "Demo note.",
  diagnosis: "Demo diagnosis",
  prescriptions: Array.from({ length: prescriptions }, (_, i) =>
    consultationPrescription(i),
  ),
  labRequests: Array.from({ length: labRequests }, (_, i) => labRequest(i)),
  createdAt: at,
});

export const labTest = () => ({
  name: "Full blood count",
  category: "Haematology",
  priceKobo: 500_000,
});

export const labOrder = (
  status: "requested" | "collected" | "resulted" = "requested",
) => ({
  consultationId: "con-001",
  patientId: "pat-001",
  testId: "tst-01",
  name: "Full blood count",
  status,
  resultText: status === "resulted" ? "Demo result" : "",
  resultedAt: status === "resulted" ? at : null,
  priceKobo: 500_000,
});

export const stockItem = () => ({
  name: "Paracetamol 500 mg",
  category: "Analgesic",
  unit: "tablet",
  quantity: 100,
  reorderLevel: 20,
  unitPriceKobo: 2_000,
});

export const prescription = (status: "pending" | "dispensed" = "pending") => ({
  consultationId: "con-001",
  patientId: "pat-001",
  stockItemId: "stk-01",
  name: "Paracetamol 500 mg",
  quantity: 10,
  status,
  dispensedAt: status === "dispensed" ? at : null,
});

export const invoiceLine = (unitPriceKobo = 5_000) => ({
  description: "Demo line",
  quantity: 2,
  unitPriceKobo,
  kind: "pharmacy",
});

export const payment = (amountKobo: number) => ({
  amountKobo,
  method: "cash",
  at,
});

/** Invoice with `lines` lines of 10,000 kobo each and the given payments. */
export const invoice = (paymentAmounts: number[] = [], lines = 1) => {
  const total = lines * 10_000;
  const paid = paymentAmounts.reduce((a, b) => a + b, 0);
  return {
    patientId: "pat-001",
    consultationId: "con-001",
    lines: Array.from({ length: lines }, () => invoiceLine()),
    totalKobo: total,
    paidKobo: paid,
    status: paid >= total ? "paid" : paid > 0 ? "part-paid" : "unpaid",
    createdAt: at,
    payments: paymentAmounts.map(payment),
  };
};

export const metaState = () => ({
  seeded: true,
  seededAt: at,
  activeRole: "receptionist",
});
