import { AlertTriangleIcon, ShieldCheckIcon } from "lucide-react";
import { formatAge } from "@/lib/format";
import type { Patient } from "@/lib/hms/patient";

const NO_ALLERGY = /^\s*(none( known)?|nil|n\/a)?\s*$/i;

/** Patient header for clinical screens, with allergies shown prominently. */
export function PatientSummary({
  patient,
  title,
}: {
  patient: Patient;
  title?: string;
}) {
  const noAllergies = NO_ALLERGY.test(patient.allergies);
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {title && <p className="text-sm text-muted-foreground">{title}</p>}
        <h1 className="text-2xl font-semibold tracking-tight">
          {patient.firstName} {patient.lastName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-mono">{patient.patientNo}</span> ·{" "}
          {formatAge(patient.dateOfBirth)} ·{" "}
          <span className="capitalize">{patient.sex}</span>
        </p>
      </div>
      {noAllergies ? (
        <p className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
          <ShieldCheckIcon className="size-4 text-primary" aria-hidden="true" />
          Allergies: none known
        </p>
      ) : (
        <p
          className="flex max-w-sm items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-900 dark:bg-rose-950 dark:text-rose-100"
          data-testid="allergy-banner"
        >
          <AlertTriangleIcon
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <span>Allergies: {patient.allergies}</span>
        </p>
      )}
    </div>
  );
}
