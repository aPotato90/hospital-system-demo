"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { FakeDataWarning } from "@/components/fake-data-warning";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { registerPatient, updatePatient } from "@/lib/hms/actions";
import { LIMITS } from "@/lib/hms/common";
import {
  patientFormSchema,
  type Patient,
  type PatientFormValues,
} from "@/lib/hms/patient";
import { useSandbox } from "@/lib/hms/sandbox-context";
import { toIsoDate } from "@/lib/format";

const EMPTY: PatientFormValues = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  sex: "female",
  phone: "",
  address: "",
  nextOfKin: { name: "", phone: "" },
  allergies: "",
};

function valuesFrom(p: Patient): PatientFormValues {
  return {
    firstName: p.firstName,
    lastName: p.lastName,
    dateOfBirth: p.dateOfBirth,
    sex: p.sex,
    phone: p.phone,
    address: p.address,
    nextOfKin: { ...p.nextOfKin },
    allergies: p.allergies,
  };
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this patient; omit to register a new one. */
  patient?: Patient;
  /** Existing patient numbers, used to issue the next one. */
  existingPatientNos?: readonly string[];
};

export function PatientFormDialog({
  open,
  onOpenChange,
  patient,
  existingPatientNos = [],
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        {open && (
          <PatientForm
            patient={patient}
            existingPatientNos={existingPatientNos}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PatientForm({
  patient,
  existingPatientNos,
  onDone,
}: {
  patient?: Patient;
  existingPatientNos: readonly string[];
  onDone: () => void;
}) {
  const sandbox = useSandbox();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: patient ? valuesFrom(patient) : EMPTY,
    mode: "onTouched",
  });
  const { register, handleSubmit, control, formState } = form;
  const errors = formState.errors;
  const editing = Boolean(patient);

  async function onSubmit(values: PatientFormValues) {
    setSubmitting(true);
    try {
      if (patient) {
        await updatePatient(sandbox, patient, values);
        toast.success("Patient details saved");
      } else {
        const id = await registerPatient(sandbox, values, existingPatientNos);
        toast.success(`${values.firstName} ${values.lastName} registered`, {
          action: {
            label: "Open",
            onClick: () => router.push(`/app/patients/${id}`),
          },
        });
      }
      onDone();
    } catch {
      toast.error(
        "Could not save the patient. Check the details and try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>
          {editing ? "Edit patient" : "Register patient"}
        </DialogTitle>
        <DialogDescription>
          {editing
            ? `Update the details for ${patient!.patientNo}.`
            : "A patient number is issued automatically."}
        </DialogDescription>
      </DialogHeader>

      <FakeDataWarning />

      <FieldGroup className="gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errors.firstName}>
            <FieldLabel htmlFor="patient-firstName">First name</FieldLabel>
            <Input
              id="patient-firstName"
              autoComplete="off"
              maxLength={LIMITS.name}
              aria-invalid={!!errors.firstName}
              {...register("firstName")}
            />
            <FieldError errors={[errors.firstName]} />
          </Field>
          <Field data-invalid={!!errors.lastName}>
            <FieldLabel htmlFor="patient-lastName">Last name</FieldLabel>
            <Input
              id="patient-lastName"
              autoComplete="off"
              maxLength={LIMITS.name}
              aria-invalid={!!errors.lastName}
              {...register("lastName")}
            />
            <FieldError errors={[errors.lastName]} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errors.dateOfBirth}>
            <FieldLabel htmlFor="patient-dateOfBirth">Date of birth</FieldLabel>
            <Input
              id="patient-dateOfBirth"
              type="date"
              max={toIsoDate(new Date())}
              aria-invalid={!!errors.dateOfBirth}
              {...register("dateOfBirth")}
            />
            <FieldError errors={[errors.dateOfBirth]} />
          </Field>
          <FieldSet>
            <FieldLegend variant="label">Sex</FieldLegend>
            <Controller
              control={control}
              name="sex"
              render={({ field: f }) => (
                <RadioGroup
                  value={f.value}
                  onValueChange={f.onChange}
                  className="flex h-8 items-center gap-5"
                  aria-label="Sex"
                >
                  {(["female", "male"] as const).map((s) => (
                    <label
                      key={s}
                      className="flex items-center gap-2 text-sm capitalize"
                    >
                      <RadioGroupItem value={s} id={`patient-sex-${s}`} />
                      {s}
                    </label>
                  ))}
                </RadioGroup>
              )}
            />
          </FieldSet>
        </div>

        <Field data-invalid={!!errors.phone}>
          <FieldLabel htmlFor="patient-phone">Phone (fake)</FieldLabel>
          <Input
            id="patient-phone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="+234 800 555 0100"
            maxLength={LIMITS.phone}
            aria-invalid={!!errors.phone}
            {...register("phone")}
          />
          <FieldError errors={[errors.phone]} />
        </Field>

        <Field data-invalid={!!errors.address}>
          <FieldLabel htmlFor="patient-address">Address (fake)</FieldLabel>
          <Input
            id="patient-address"
            autoComplete="off"
            maxLength={LIMITS.address}
            aria-invalid={!!errors.address}
            {...register("address")}
          />
          <FieldError errors={[errors.address]} />
        </Field>

        <FieldSet>
          <FieldLegend variant="label">Next of kin</FieldLegend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.nextOfKin?.name}>
              <FieldLabel htmlFor="patient-kin-name">Name</FieldLabel>
              <Input
                id="patient-kin-name"
                autoComplete="off"
                maxLength={LIMITS.name}
                aria-invalid={!!errors.nextOfKin?.name}
                {...register("nextOfKin.name")}
              />
              <FieldError errors={[errors.nextOfKin?.name]} />
            </Field>
            <Field data-invalid={!!errors.nextOfKin?.phone}>
              <FieldLabel htmlFor="patient-kin-phone">Phone (fake)</FieldLabel>
              <Input
                id="patient-kin-phone"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                maxLength={LIMITS.phone}
                aria-invalid={!!errors.nextOfKin?.phone}
                {...register("nextOfKin.phone")}
              />
              <FieldError errors={[errors.nextOfKin?.phone]} />
            </Field>
          </div>
        </FieldSet>

        <Field data-invalid={!!errors.allergies}>
          <FieldLabel htmlFor="patient-allergies">Allergies</FieldLabel>
          <Textarea
            id="patient-allergies"
            rows={2}
            maxLength={LIMITS.shortText}
            placeholder="None known"
            aria-invalid={!!errors.allergies}
            {...register("allergies")}
          />
          <FieldError errors={[errors.allergies]} />
        </Field>
      </FieldGroup>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onDone}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && (
            <Loader2Icon className="animate-spin" aria-hidden="true" />
          )}
          {editing ? "Save changes" : "Register patient"}
        </Button>
      </DialogFooter>
    </form>
  );
}
