"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, isPast, startOfDay } from "date-fns";
import { getDocs, query, where } from "firebase/firestore";
import { Loader2Icon } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime, staffDisplayName, toIsoDate } from "@/lib/format";
import { bookAppointment } from "@/lib/hms/actions";
import {
  bookAppointmentFormSchema,
  CLINIC_CLOSE_HOUR,
  CLINIC_OPEN_HOUR,
  combineDateTime,
  type BookAppointmentFormValues,
} from "@/lib/hms/appointment";
import { CLINICAL_DEPARTMENTS, LIMITS } from "@/lib/hms/common";
import { useCollection } from "@/lib/hms/hooks";
import { collectionRef } from "@/lib/hms/repo";
import { useSandbox } from "@/lib/hms/sandbox-context";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-filled date (YYYY-MM-DD). */
  defaultDate: string;
  /** Called with the booked appointment's date. */
  onBooked?: (date: string) => void;
};

export function BookAppointmentDialog({
  open,
  onOpenChange,
  defaultDate,
  onBooked,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        {open && (
          <BookingForm
            defaultDate={defaultDate}
            onDone={(date) => {
              onOpenChange(false);
              if (date) onBooked?.(date);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function BookingForm({
  defaultDate,
  onDone,
}: {
  defaultDate: string;
  onDone: (bookedDate?: string) => void;
}) {
  const sandbox = useSandbox();
  const patients = useCollection("patients");
  const staff = useCollection("staff");
  const [submitting, setSubmitting] = useState(false);
  const todayIso = toIsoDate(new Date());

  const form = useForm<BookAppointmentFormValues>({
    resolver: zodResolver(bookAppointmentFormSchema),
    defaultValues: {
      patientId: "",
      department: "General Practice",
      doctorId: "",
      date: defaultDate < todayIso ? todayIso : defaultDate,
      time: "09:00",
      reason: "",
    },
    mode: "onTouched",
  });
  const { control, register, handleSubmit, formState, setValue, setError } =
    form;
  const errors = formState.errors;
  const department = useWatch({ control, name: "department" });

  const sortedPatients = useMemo(
    () =>
      [...(patients.data ?? [])].sort(
        (a, b) =>
          a.lastName.localeCompare(b.lastName) ||
          a.firstName.localeCompare(b.firstName),
      ),
    [patients.data],
  );
  const doctors = useMemo(
    () =>
      (staff.data ?? []).filter(
        (s) => s.role === "doctor" && s.department === department,
      ),
    [staff.data, department],
  );

  async function onSubmit(values: BookAppointmentFormValues) {
    const when = combineDateTime(values.date, values.time);
    if (isPast(when)) {
      setError("time", { message: "Choose a time in the future" });
      return;
    }
    setSubmitting(true);
    try {
      // The same doctor cannot be booked twice at the same time.
      const day = startOfDay(when);
      const sameDay = await getDocs(
        query(
          collectionRef(sandbox.db, sandbox.uid, "appointments"),
          where("scheduledAt", ">=", day),
          where("scheduledAt", "<", addDays(day, 1)),
        ),
      );
      const clash = sameDay.docs
        .map((d) => d.data())
        .some(
          (a) =>
            a.doctorId === values.doctorId &&
            a.scheduledAt.getTime() === when.getTime() &&
            a.status !== "cancelled",
        );
      if (clash) {
        setError("time", {
          message: "This doctor already has an appointment at that time",
        });
        setSubmitting(false);
        return;
      }
      await bookAppointment(sandbox, values);
      const patient = patients.data?.find((p) => p.id === values.patientId);
      toast.success(
        `Booked ${patient ? `${patient.firstName} ${patient.lastName}` : "appointment"} for ${formatDateTime(when)}`,
      );
      onDone(values.date);
    } catch {
      toast.error("Could not book the appointment. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Book appointment</DialogTitle>
        <DialogDescription>
          Clinic hours are {CLINIC_OPEN_HOUR}:00 to {CLINIC_CLOSE_HOUR}:00.
        </DialogDescription>
      </DialogHeader>

      <FakeDataWarning />

      <FieldGroup className="gap-4">
        <Field data-invalid={!!errors.patientId}>
          <FieldLabel htmlFor="book-patient">Patient</FieldLabel>
          <Controller
            control={control}
            name="patientId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger
                  id="book-patient"
                  className="w-full"
                  aria-invalid={!!errors.patientId}
                  onBlur={field.onBlur}
                >
                  <SelectValue
                    placeholder={
                      patients.loading
                        ? "Loading patients…"
                        : "Choose a patient"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {sortedPatients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.lastName}, {p.firstName} · {p.patientNo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError errors={[errors.patientId]} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="book-department">Department</FieldLabel>
            <Controller
              control={control}
              name="department"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v);
                    setValue("doctorId", "");
                  }}
                >
                  <SelectTrigger id="book-department" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLINICAL_DEPARTMENTS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field data-invalid={!!errors.doctorId}>
            <FieldLabel htmlFor="book-doctor">Doctor</FieldLabel>
            <Controller
              control={control}
              name="doctorId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="book-doctor"
                    className="w-full"
                    aria-invalid={!!errors.doctorId}
                    onBlur={field.onBlur}
                  >
                    <SelectValue placeholder="Choose a doctor" />
                  </SelectTrigger>
                  <SelectContent>
                    {doctors.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {staffDisplayName(d)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError errors={[errors.doctorId]} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errors.date}>
            <FieldLabel htmlFor="book-date">Date</FieldLabel>
            <Input
              id="book-date"
              type="date"
              min={todayIso}
              aria-invalid={!!errors.date}
              {...register("date")}
            />
            <FieldError errors={[errors.date]} />
          </Field>
          <Field data-invalid={!!errors.time}>
            <FieldLabel htmlFor="book-time">Time</FieldLabel>
            <Input
              id="book-time"
              type="time"
              step={900}
              min={`${String(CLINIC_OPEN_HOUR).padStart(2, "0")}:00`}
              max={`${CLINIC_CLOSE_HOUR}:00`}
              aria-invalid={!!errors.time}
              {...register("time")}
            />
            <FieldError errors={[errors.time]} />
          </Field>
        </div>

        <Field data-invalid={!!errors.reason}>
          <FieldLabel htmlFor="book-reason">Reason for visit</FieldLabel>
          <Input
            id="book-reason"
            autoComplete="off"
            maxLength={LIMITS.shortText}
            aria-invalid={!!errors.reason}
            aria-describedby="book-reason-hint"
            {...register("reason")}
          />
          <FieldDescription id="book-reason-hint">
            A short, made-up reason such as &ldquo;Routine check&rdquo;.
          </FieldDescription>
          <FieldError errors={[errors.reason]} />
        </Field>
      </FieldGroup>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => onDone()}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && (
            <Loader2Icon className="animate-spin" aria-hidden="true" />
          )}
          Book appointment
        </Button>
      </DialogFooter>
    </form>
  );
}
