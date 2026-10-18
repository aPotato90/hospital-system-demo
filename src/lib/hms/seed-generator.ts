import { addDays, addMinutes, differenceInYears, startOfDay } from "date-fns";
import type { AppointmentData } from "./appointment";
import type { ClinicalDepartment, WithId } from "./common";
import type { ConsultationData } from "./consultation";
import {
  sumLinesKobo,
  sumPaymentsKobo,
  type InvoiceData,
  type InvoiceLine,
  type Payment,
} from "./invoice";
import type { LabOrderData } from "./lab-order";
import type { LabTestData } from "./lab-test";
import { formatPatientNo, type PatientData, type Sex } from "./patient";
import type { PrescriptionData } from "./prescription";
import type { StaffData } from "./staff";
import type { StockItemData } from "./stock-item";
import {
  invoiceStatusFor,
  type AppointmentStatus,
  type LabOrderStatus,
} from "./transitions";

/**
 * Deterministic fake data for a visitor's sandbox. Everything here is invented:
 * names are random combinations, phone numbers use the +234 800 555 0xxx
 * pattern, addresses are fictional, emails are @example.com.
 *
 * Given the same anchor day the output is identical (no network, no
 * Math.random). Dates are spread over the 30 days before and 7 days after the
 * anchor so the demo always looks current.
 */

export type SeedData = {
  patients: WithId<PatientData>[];
  staff: WithId<StaffData>[];
  stockItems: WithId<StockItemData>[];
  labTests: WithId<LabTestData>[];
  appointments: WithId<AppointmentData>[];
  consultations: WithId<ConsultationData>[];
  labOrders: WithId<LabOrderData>[];
  prescriptions: WithId<PrescriptionData>[];
  invoices: WithId<InvoiceData>[];
};

export const SEED_COUNTS = {
  patients: 40,
  staff: 14,
  stockItems: 30,
  labTests: 12,
  appointments: 60,
} as const;

/** Consultation fee per clinical department, in kobo. */
export const CONSULTATION_FEES_KOBO: Record<ClinicalDepartment, number> = {
  "General Practice": 1_000_000,
  Paediatrics: 800_000,
  Obstetrics: 1_200_000,
};

// Small, fast, deterministic PRNG (mulberry32).
function createRandom(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) =>
      min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: readonly T[]): T =>
      items[Math.floor(next() * items.length)],
    chance: (p: number) => next() < p,
  };
}
type Random = ReturnType<typeof createRandom>;

const pad = (n: number, width: number) => String(n).padStart(width, "0");

const FEMALE_FIRST = [
  "Adaeze",
  "Ngozi",
  "Funmilayo",
  "Aisha",
  "Zainab",
  "Chiamaka",
  "Yetunde",
  "Hauwa",
  "Ifeoma",
  "Bisola",
  "Amina",
  "Kemi",
  "Nkechi",
  "Folake",
  "Halima",
  "Oluchi",
  "Temitope",
  "Ebere",
  "Damilola",
  "Rukayat",
] as const;

const MALE_FIRST = [
  "Chidi",
  "Tunde",
  "Emeka",
  "Ibrahim",
  "Kelechi",
  "Obinna",
  "Segun",
  "Bolaji",
  "Femi",
  "Ikenna",
  "Yusuf",
  "Babatunde",
  "Chukwuma",
  "Danladi",
  "Gbenga",
  "Nnamdi",
  "Sani",
  "Tobi",
  "Uchenna",
  "Kayode",
] as const;

const SURNAMES = [
  "Okafor",
  "Adeyemi",
  "Bello",
  "Eze",
  "Ogunleye",
  "Mohammed",
  "Nwosu",
  "Abubakar",
  "Okonkwo",
  "Adebayo",
  "Ibekwe",
  "Lawal",
  "Olawale",
  "Danjuma",
  "Chukwu",
  "Ogundipe",
  "Umar",
  "Nwachukwu",
  "Afolabi",
  "Yakubu",
  "Akande",
  "Garba",
  "Onyeka",
  "Balogun",
  "Ekwueme",
  "Salami",
  "Ugwu",
  "Bakare",
  "Usman",
  "Odinaka",
] as const;

const STREETS = [
  "Mango Avenue",
  "Riverside Crescent",
  "Unity Close",
  "Harmony Road",
  "Palm Grove Street",
  "Sunrise Lane",
  "Cocoa Way",
  "Lily Drive",
] as const;

const AREAS = [
  "Riverside Demo Estate, Lagos",
  "Greenfield Demo Layout, Abuja",
  "Hilltop Demo Gardens, Ibadan",
  "Lakeside Demo Estate, Enugu",
] as const;

const ALLERGIES = [
  "Penicillin",
  "Sulfa drugs",
  "Peanuts",
  "Latex",
  "Shellfish",
] as const;

const fakePhone = (n: number) => `+234 800 555 ${pad(n % 10000, 4)}`;

// Age bands make sure every department has suitable patients:
// children for Paediatrics, women of 18-42 for Obstetrics, adults for GP.
type PatientProfile = { sex: Sex; minAge: number; maxAge: number };
const PATIENT_PROFILES: PatientProfile[] = [
  ...Array.from({ length: 9 }, (_, i): PatientProfile => ({
    sex: i % 2 === 0 ? "female" : "male",
    minAge: 0,
    maxAge: 14,
  })),
  ...Array.from({ length: 10 }, (): PatientProfile => ({
    sex: "female",
    minAge: 19,
    maxAge: 41,
  })),
  ...Array.from({ length: 21 }, (_, i): PatientProfile => ({
    sex: i % 2 === 0 ? "male" : "female",
    minAge: 18,
    maxAge: 82,
  })),
];

function isoDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}`;
}

function generatePatients(rand: Random, anchor: Date): WithId<PatientData>[] {
  const usedNames = new Set<string>();
  const patients = PATIENT_PROFILES.map((profile, i) => {
    let firstName: string;
    let lastName: string;
    do {
      firstName = rand.pick(
        profile.sex === "female" ? FEMALE_FIRST : MALE_FIRST,
      );
      lastName = rand.pick(SURNAMES);
    } while (usedNames.has(`${firstName} ${lastName}`));
    usedNames.add(`${firstName} ${lastName}`);

    const age = rand.int(profile.minAge, profile.maxAge);
    const dob = addDays(anchor, -(age * 365 + rand.int(30, 330)));
    const kinIsFemale = rand.chance(0.5);
    return {
      id: `pat-${pad(i + 1, 3)}`,
      patientNo: "",
      firstName,
      lastName,
      dateOfBirth: isoDate(dob),
      sex: profile.sex,
      phone: fakePhone(100 + i),
      address: `${rand.int(1, 120)} ${rand.pick(STREETS)}, ${rand.pick(AREAS)}`,
      nextOfKin: {
        name: `${rand.pick(kinIsFemale ? FEMALE_FIRST : MALE_FIRST)} ${lastName}`,
        phone: fakePhone(500 + i),
      },
      allergies: rand.chance(0.25) ? rand.pick(ALLERGIES) : "None known",
      // Registered between ~13 months and 5 weeks before the anchor day.
      registeredAt: addMinutes(
        addDays(anchor, -rand.int(35, 400)),
        rand.int(8 * 60, 16 * 60),
      ),
    };
  });

  // Patient numbers follow registration order.
  [...patients]
    .sort((a, b) => a.registeredAt.getTime() - b.registeredAt.getTime())
    .forEach((p, i) => {
      p.patientNo = formatPatientNo(101 + i);
    });
  return patients;
}

const STAFF: WithId<StaffData>[] = [
  ["stf-01", "Blessing Okoro", "receptionist", "General Practice"],
  ["stf-02", "Adewale Martins", "receptionist", "General Practice"],
  ["stf-03", "Ifeanyi Obi", "doctor", "General Practice"],
  ["stf-04", "Fatima Bello", "doctor", "General Practice"],
  ["stf-05", "Kunle Ajayi", "doctor", "Paediatrics"],
  ["stf-06", "Amara Nwankwo", "doctor", "Paediatrics"],
  ["stf-07", "Hadiza Sule", "doctor", "Obstetrics"],
  ["stf-08", "Toyin Adeleke", "doctor", "Obstetrics"],
  ["stf-09", "Chinedu Eke", "lab", "Laboratory"],
  ["stf-10", "Rahma Aliyu", "lab", "Laboratory"],
  ["stf-11", "Ngozi Ude", "pharmacist", "Pharmacy"],
  ["stf-12", "Sadiq Abdullahi", "pharmacist", "Pharmacy"],
  ["stf-13", "Grace Edet", "cashier", "General Practice"],
  ["stf-14", "Kayode Ilori", "admin", "General Practice"],
].map(([id, name, role, department]) => ({
  id,
  name,
  role,
  department,
  email: `${name.toLowerCase().replace(" ", ".")}@example.com`,
})) as WithId<StaffData>[];

// [name, category, unit, quantity, reorderLevel, unit price in naira]
const STOCK: [string, string, string, number, number, number][] = [
  ["Paracetamol 500 mg", "Analgesic", "tablet", 2400, 500, 20],
  ["Ibuprofen 400 mg", "Analgesic", "tablet", 900, 300, 35],
  ["Paracetamol syrup 120 mg/5 ml", "Analgesic", "bottle", 45, 30, 850],
  ["Amoxicillin 500 mg", "Antibiotic", "capsule", 1200, 400, 60],
  ["Amoxicillin suspension 125 mg/5 ml", "Antibiotic", "bottle", 18, 25, 1500],
  ["Azithromycin 500 mg", "Antibiotic", "tablet", 140, 100, 450],
  ["Ciprofloxacin 500 mg", "Antibiotic", "tablet", 600, 200, 90],
  ["Metronidazole 400 mg", "Antibiotic", "tablet", 750, 250, 40],
  [
    "Artemether-lumefantrine 20/120 mg",
    "Antimalarial",
    "tablet",
    960,
    480,
    125,
  ],
  ["Amlodipine 5 mg", "Cardiovascular", "tablet", 1100, 300, 45],
  ["Lisinopril 10 mg", "Cardiovascular", "tablet", 260, 300, 70],
  ["Metformin 500 mg", "Diabetes", "tablet", 1500, 400, 30],
  ["Omeprazole 20 mg", "Gastrointestinal", "capsule", 480, 200, 55],
  ["Oral rehydration salts", "Gastrointestinal", "sachet", 320, 150, 150],
  ["Zinc sulphate 20 mg", "Supplement", "tablet", 400, 200, 25],
  ["Folic acid 5 mg", "Supplement", "tablet", 2000, 500, 10],
  ["Ferrous sulphate 200 mg", "Supplement", "tablet", 1800, 500, 15],
  ["Vitamin C 100 mg", "Supplement", "tablet", 1300, 400, 10],
  ["Prenatal multivitamin", "Supplement", "tablet", 220, 300, 80],
  ["Loratadine 10 mg", "Antihistamine", "tablet", 380, 150, 50],
  ["Cetirizine syrup 5 mg/5 ml", "Antihistamine", "bottle", 22, 20, 1200],
  ["Salbutamol inhaler 100 mcg", "Respiratory", "inhaler", 14, 15, 3500],
  ["Hydrocortisone cream 1%", "Dermatological", "tube", 40, 20, 900],
  ["Sodium chloride 0.9% 500 ml", "IV fluid", "bag", 75, 40, 1100],
  ["Dextrose 5% 500 ml", "IV fluid", "bag", 30, 40, 1200],
  ["Chlorhexidine solution 500 ml", "Consumable", "bottle", 26, 10, 2200],
  ["Gauze roll", "Consumable", "roll", 150, 60, 300],
  ["Syringe 5 ml", "Consumable", "piece", 1400, 500, 50],
  ["Examination gloves", "Consumable", "pair", 800, 400, 70],
  ["Cotton wool 100 g", "Consumable", "pack", 55, 30, 650],
];

// [name, category, price in naira]
const LAB_TESTS: [string, string, number][] = [
  ["Full blood count", "Haematology", 5000],
  ["Malaria parasite test", "Parasitology", 2500],
  ["Widal test", "Serology", 3000],
  ["Urinalysis", "Chemistry", 2000],
  ["Fasting blood sugar", "Chemistry", 2000],
  ["HbA1c", "Chemistry", 8000],
  ["Lipid profile", "Chemistry", 10000],
  ["Liver function test", "Chemistry", 9000],
  ["Electrolytes, urea and creatinine", "Chemistry", 9500],
  ["Urine pregnancy test", "Serology", 1500],
  ["Hepatitis B surface antigen", "Serology", 3500],
  ["Blood group and genotype", "Haematology", 4000],
];

/** Fake visit templates per department: reason, diagnosis, tests, drugs. */
type VisitTemplate = {
  reason: string;
  diagnosis: string;
  notes: string;
  tests: string[];
  drugs: [stockItemId: string, dose: string, quantity: number][];
};

const VISITS: Record<ClinicalDepartment, VisitTemplate[]> = {
  "General Practice": [
    {
      reason: "Fever and headache for three days",
      diagnosis: "Uncomplicated malaria (demo record)",
      notes: "Demo note: febrile, alert, no danger signs. Fictional record.",
      tests: ["tst-02", "tst-01"],
      drugs: [
        ["stk-09", "4 tablets twice daily for 3 days", 24],
        ["stk-01", "2 tablets three times daily", 18],
      ],
    },
    {
      reason: "Blood pressure review",
      diagnosis: "Hypertension follow-up (demo record)",
      notes:
        "Demo note: routine review, readings recorded in chart. Fictional.",
      tests: ["tst-09"],
      drugs: [["stk-10", "1 tablet daily", 30]],
    },
    {
      reason: "Cough and sore throat",
      diagnosis: "Upper respiratory tract infection (demo record)",
      notes: "Demo note: mild symptoms, advised fluids and rest. Fictional.",
      tests: [],
      drugs: [
        ["stk-20", "1 tablet daily", 7],
        ["stk-18", "1 tablet daily", 14],
      ],
    },
    {
      reason: "Diabetes check-up",
      diagnosis: "Type 2 diabetes review (demo record)",
      notes: "Demo note: routine review. Fictional record.",
      tests: ["tst-05", "tst-06"],
      drugs: [["stk-12", "1 tablet twice daily", 60]],
    },
    {
      reason: "Stomach pain after meals",
      diagnosis: "Dyspepsia (demo record)",
      notes: "Demo note: no alarm features. Fictional record.",
      tests: [],
      drugs: [["stk-13", "1 capsule daily before breakfast", 14]],
    },
  ],
  Paediatrics: [
    {
      reason: "Child with fever",
      diagnosis: "Febrile illness, malaria test positive (demo record)",
      notes: "Demo note: child active and feeding. Fictional record.",
      tests: ["tst-02"],
      drugs: [
        ["stk-09", "Weight-based course as charted", 6],
        ["stk-03", "As charted", 1],
      ],
    },
    {
      reason: "Diarrhoea for two days",
      diagnosis: "Acute gastroenteritis (demo record)",
      notes: "Demo note: mild dehydration signs absent. Fictional record.",
      tests: [],
      drugs: [
        ["stk-14", "As charted", 4],
        ["stk-15", "As charted", 10],
      ],
    },
    {
      reason: "Routine growth check",
      diagnosis: "Well child review (demo record)",
      notes: "Demo note: growth on track. Fictional record.",
      tests: [],
      drugs: [],
    },
    {
      reason: "Cough and runny nose",
      diagnosis: "Common cold (demo record)",
      notes: "Demo note: chest clear. Fictional record.",
      tests: ["tst-01"],
      drugs: [["stk-21", "As charted", 1]],
    },
  ],
  Obstetrics: [
    {
      reason: "Antenatal booking visit",
      diagnosis: "Antenatal care, booking (demo record)",
      notes: "Demo note: booking bloods requested. Fictional record.",
      tests: ["tst-01", "tst-12", "tst-11"],
      drugs: [
        ["stk-19", "1 tablet daily", 30],
        ["stk-16", "1 tablet daily", 30],
      ],
    },
    {
      reason: "Routine antenatal visit",
      diagnosis: "Antenatal care, routine (demo record)",
      notes: "Demo note: routine visit. Fictional record.",
      tests: ["tst-04"],
      drugs: [["stk-17", "1 tablet daily", 30]],
    },
    {
      reason: "Pregnancy confirmation",
      diagnosis: "Early pregnancy (demo record)",
      notes: "Demo note: test requested. Fictional record.",
      tests: ["tst-10"],
      drugs: [["stk-16", "1 tablet daily", 30]],
    },
  ],
};

const PAYMENT_METHODS = ["cash", "card", "transfer"] as const;

function suitable(dept: ClinicalDepartment, p: PatientData, anchor: Date) {
  const age = differenceInYears(anchor, new Date(`${p.dateOfBirth}T00:00:00`));
  if (dept === "Paediatrics") return age < 16;
  if (dept === "Obstetrics")
    return p.sex === "female" && age >= 18 && age <= 45;
  return age >= 16;
}

/** Day offsets (relative to the anchor) for the 60 appointments. */
function appointmentDayOffsets(rand: Random): number[] {
  const past = Array.from({ length: 44 }, () => -rand.int(1, 30));
  const today = Array.from({ length: 9 }, () => 0);
  const future = Array.from({ length: 7 }, () => rand.int(1, 7));
  return [...past, ...today, ...future].sort((a, b) => a - b);
}

function pastStatus(rand: Random): AppointmentStatus {
  const r = rand.next();
  if (r < 0.78) return "completed";
  if (r < 0.89) return "no-show";
  return "cancelled";
}

// Today's list shows the whole flow at once.
const TODAY_STATUSES: AppointmentStatus[] = [
  "completed",
  "completed",
  "in-consultation",
  "checked-in",
  "checked-in",
  "scheduled",
  "scheduled",
  "scheduled",
  "cancelled",
];

/**
 * Build a full sandbox. `anchor` is any time on the day the demo should centre
 * on; the output only depends on that calendar day.
 */
export function generateSeedData(anchor: Date = new Date()): SeedData {
  const day = startOfDay(anchor);
  const rand = createRandom(0x5eed2026);

  const patients = generatePatients(rand, day);
  const staff = STAFF.map((s) => ({ ...s }));

  const stockItems: WithId<StockItemData>[] = STOCK.map(
    ([name, category, unit, quantity, reorderLevel, naira], i) => ({
      id: `stk-${pad(i + 1, 2)}`,
      name,
      category,
      unit,
      quantity,
      reorderLevel,
      unitPriceKobo: naira * 100,
    }),
  );
  const stockById = new Map(stockItems.map((s) => [s.id, s]));

  const labTests: WithId<LabTestData>[] = LAB_TESTS.map(
    ([name, category, naira], i) => ({
      id: `tst-${pad(i + 1, 2)}`,
      name,
      category,
      priceKobo: naira * 100,
    }),
  );
  const testById = new Map(labTests.map((t) => [t.id, t]));

  const doctorsByDept = new Map<ClinicalDepartment, WithId<StaffData>[]>();
  for (const s of staff) {
    if (s.role !== "doctor") continue;
    const dept = s.department as ClinicalDepartment;
    doctorsByDept.set(dept, [...(doctorsByDept.get(dept) ?? []), s]);
  }

  const appointments: WithId<AppointmentData>[] = [];
  const consultations: WithId<ConsultationData>[] = [];
  const labOrders: WithId<LabOrderData>[] = [];
  const prescriptions: WithId<PrescriptionData>[] = [];
  const invoices: WithId<InvoiceData>[] = [];

  const usedSlots = new Set<string>();
  let todayIndex = 0;

  appointmentDayOffsets(rand).forEach((offset, i) => {
    const department = rand.pick([
      "General Practice",
      "General Practice",
      "General Practice",
      "Paediatrics",
      "Obstetrics",
    ] as const);
    const doctor = rand.pick(doctorsByDept.get(department) ?? []);
    const candidates = patients.filter((p) => suitable(department, p, day));
    const patient = rand.pick(candidates);

    // A free 30-minute slot between 08:00 and 16:30 for this doctor.
    let scheduledAt: Date;
    let slotKey: string;
    do {
      const minutes = 8 * 60 + rand.int(0, 17) * 30;
      scheduledAt = addMinutes(addDays(day, offset), minutes);
      slotKey = `${doctor.id}@${scheduledAt.getTime()}`;
    } while (usedSlots.has(slotKey));
    usedSlots.add(slotKey);

    const status: AppointmentStatus =
      offset < 0
        ? pastStatus(rand)
        : offset === 0
          ? TODAY_STATUSES[todayIndex++ % TODAY_STATUSES.length]
          : rand.chance(0.12)
            ? "cancelled"
            : "scheduled";

    const template = rand.pick(VISITS[department]);
    const appointmentId = `apt-${pad(i + 1, 3)}`;
    appointments.push({
      id: appointmentId,
      patientId: patient.id,
      doctorId: doctor.id,
      department,
      scheduledAt,
      status,
      reason: template.reason,
    });

    if (status !== "completed") return;

    // Completed visits carry the whole downstream record.
    const n = consultations.length + 1;
    const consultationId = `con-${pad(n, 3)}`;
    const createdAt = addMinutes(scheduledAt, 20);
    const daysAgo = -offset;
    consultations.push({
      id: consultationId,
      appointmentId,
      patientId: patient.id,
      doctorId: doctor.id,
      notes: template.notes,
      diagnosis: template.diagnosis,
      prescriptions: template.drugs.map(([stockItemId, dose, quantity]) => ({
        stockItemId,
        name: stockById.get(stockItemId)!.name,
        dose,
        quantity,
      })),
      labRequests: template.tests.map((testId) => ({
        testId,
        name: testById.get(testId)!.name,
      })),
      createdAt,
    });

    const lines: InvoiceLine[] = [
      {
        description: `${department} consultation`,
        quantity: 1,
        unitPriceKobo: CONSULTATION_FEES_KOBO[department],
        kind: "consultation",
      },
    ];

    template.tests.forEach((testId) => {
      const test = testById.get(testId)!;
      // Older orders are resulted; today's are still in the lab.
      const labStatus: LabOrderStatus =
        daysAgo >= 1
          ? "resulted"
          : rand.chance(0.5)
            ? "collected"
            : "requested";
      labOrders.push({
        id: `lab-${pad(labOrders.length + 1, 3)}`,
        consultationId,
        patientId: patient.id,
        testId,
        name: test.name,
        status: labStatus,
        resultText:
          labStatus === "resulted"
            ? "Demo result: values recorded for illustration only. Not a real test."
            : "",
        resultedAt:
          labStatus === "resulted" ? addMinutes(createdAt, 180) : null,
        priceKobo: test.priceKobo,
      });
      lines.push({
        description: test.name,
        quantity: 1,
        unitPriceKobo: test.priceKobo,
        kind: "lab",
      });
    });

    template.drugs.forEach(([stockItemId, , quantity]) => {
      const item = stockById.get(stockItemId)!;
      const dispensed = daysAgo >= 1 || rand.chance(0.3);
      prescriptions.push({
        id: `rx-${pad(prescriptions.length + 1, 3)}`,
        consultationId,
        patientId: patient.id,
        stockItemId,
        name: item.name,
        quantity,
        status: dispensed ? "dispensed" : "pending",
        dispensedAt: dispensed ? addMinutes(createdAt, 60) : null,
      });
      lines.push({
        description: item.name,
        quantity,
        unitPriceKobo: item.unitPriceKobo,
        kind: "pharmacy",
      });
    });

    const totalKobo = sumLinesKobo(lines);
    const method = rand.pick(PAYMENT_METHODS);
    const paidAt = addMinutes(createdAt, 90);
    let payments: Payment[] = [];
    const r = rand.next();
    if (daysAgo >= 3 && r < 0.8) {
      payments = [{ amountKobo: totalKobo, method, at: paidAt }];
    } else if (daysAgo >= 1 && r < 0.6) {
      const first = Math.round(totalKobo / 2 / 100) * 100;
      payments = [{ amountKobo: first, method, at: paidAt }];
    }
    const paidKobo = sumPaymentsKobo(payments);
    invoices.push({
      id: `inv-${pad(invoices.length + 1, 3)}`,
      patientId: patient.id,
      consultationId,
      lines,
      totalKobo,
      paidKobo,
      status: invoiceStatusFor(totalKobo, paidKobo),
      createdAt: addMinutes(createdAt, 30),
      payments,
    });
  });

  return {
    patients,
    staff,
    stockItems,
    labTests,
    appointments,
    consultations,
    labOrders,
    prescriptions,
    invoices,
  };
}
