"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { FakeDataWarning } from "@/components/fake-data-warning";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
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
import { Textarea } from "@/components/ui/textarea";
import type { Appointment } from "@/lib/hms/appointment";
import {
  commitConsultationSave,
  idGenerator,
  loadConsultationRecords,
} from "@/lib/hms/clinical-actions";
import { LIMITS } from "@/lib/hms/common";
import {
  ConsultationPlanError,
  consultationFormSchema,
  planConsultationSave,
  type ConsultationFormValues,
} from "@/lib/hms/consultation-plan";
import type { LabTest } from "@/lib/hms/lab-test";
import { formatNaira } from "@/lib/hms/money";
import { useSandbox } from "@/lib/hms/sandbox-context";
import type { StockItem } from "@/lib/hms/stock-item";

export function ConsultationForm({
  appointment,
  stockItems,
  labTests,
  defaultValues,
  editing,
  onDone,
}: {
  appointment: Appointment;
  stockItems: StockItem[];
  labTests: LabTest[];
  defaultValues: ConsultationFormValues;
  editing: boolean;
  onDone: () => void;
}) {
  const sandbox = useSandbox();
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<ConsultationFormValues>({
    resolver: zodResolver(consultationFormSchema),
    defaultValues,
    mode: "onTouched",
  });
  const { control, register, handleSubmit, formState } = form;
  const errors = formState.errors;
  const rx = useFieldArray({ control, name: "prescriptions" });
  const labs = useFieldArray({ control, name: "labRequests" });
  const stockSorted = [...stockItems].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const testsSorted = [...labTests].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  async function onSubmit(values: ConsultationFormValues) {
    setSubmitting(true);
    try {
      // Re-read what is stored so the lock check uses the latest state.
      const existing = await loadConsultationRecords(sandbox, appointment.id);
      const plan = planConsultationSave({
        appointment,
        existing,
        values,
        stockById: new Map(stockItems.map((s) => [s.id, s])),
        testById: new Map(labTests.map((t) => [t.id, t])),
        now: new Date(),
        newId: idGenerator(sandbox),
      });
      await commitConsultationSave(sandbox, appointment, plan);
      const invoice = plan.writes.find((w) => w.collection === "invoices");
      const total =
        invoice && invoice.op === "set" && "totalKobo" in invoice.data
          ? ` Invoice: ${formatNaira(invoice.data.totalKobo)}.`
          : "";
      toast.success(
        plan.isNew
          ? `Visit completed.${total}`
          : `Consultation updated.${total}`,
      );
      onDone();
    } catch (e) {
      toast.error(
        e instanceof ConsultationPlanError
          ? e.message
          : "Could not save the consultation. Try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      <FakeDataWarning />

      <div className="grid gap-4">
        <Field data-invalid={!!errors.diagnosis}>
          <FieldLabel htmlFor="consult-diagnosis">Diagnosis</FieldLabel>
          <Input
            id="consult-diagnosis"
            autoComplete="off"
            maxLength={LIMITS.text}
            aria-invalid={!!errors.diagnosis}
            {...register("diagnosis")}
          />
          <FieldError errors={[errors.diagnosis]} />
        </Field>
        <Field data-invalid={!!errors.notes}>
          <FieldLabel htmlFor="consult-notes">Notes</FieldLabel>
          <Textarea
            id="consult-notes"
            rows={4}
            maxLength={LIMITS.text}
            aria-invalid={!!errors.notes}
            aria-describedby="consult-notes-hint"
            {...register("notes")}
          />
          <FieldDescription id="consult-notes-hint">
            Free text, up to {LIMITS.text.toLocaleString("en-NG")} characters.
          </FieldDescription>
          <FieldError errors={[errors.notes]} />
        </Field>
      </div>

      <fieldset className="space-y-3">
        <legend className="font-semibold">
          Prescriptions{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({rx.fields.length} of {LIMITS.prescriptions})
          </span>
        </legend>
        {rx.fields.length === 0 && (
          <p className="text-sm text-muted-foreground">No items prescribed.</p>
        )}
        {rx.fields.map((field, i) => {
          const e = errors.prescriptions?.[i];
          return (
            <fieldset
              key={field.id}
              className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[2fr_2fr_1fr_auto] sm:items-start"
              data-testid="rx-row"
            >
              <legend className="sr-only">Prescription {i + 1}</legend>
              <Field data-invalid={!!e?.stockItemId}>
                <FieldLabel htmlFor={`rx-${i}-item`}>Item</FieldLabel>
                <Controller
                  control={control}
                  name={`prescriptions.${i}.stockItemId`}
                  render={({ field: f }) => (
                    <Select value={f.value} onValueChange={f.onChange}>
                      <SelectTrigger
                        id={`rx-${i}-item`}
                        className="w-full"
                        aria-invalid={!!e?.stockItemId}
                        onBlur={f.onBlur}
                      >
                        <SelectValue placeholder="Choose an item" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {stockSorted.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} ({s.quantity} {s.unit} in stock)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError errors={[e?.stockItemId]} />
              </Field>
              <Field data-invalid={!!e?.dose}>
                <FieldLabel htmlFor={`rx-${i}-dose`}>
                  Dose (as written)
                </FieldLabel>
                <Input
                  id={`rx-${i}-dose`}
                  autoComplete="off"
                  maxLength={LIMITS.shortText}
                  aria-invalid={!!e?.dose}
                  {...register(`prescriptions.${i}.dose`)}
                />
                <FieldError errors={[e?.dose]} />
              </Field>
              <Field data-invalid={!!e?.quantity}>
                <FieldLabel htmlFor={`rx-${i}-qty`}>Quantity</FieldLabel>
                <Input
                  id={`rx-${i}-qty`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={LIMITS.quantity}
                  aria-invalid={!!e?.quantity}
                  {...register(`prescriptions.${i}.quantity`, {
                    valueAsNumber: true,
                  })}
                />
                <FieldError errors={[e?.quantity]} />
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="sm:mt-6"
                onClick={() => rx.remove(i)}
                aria-label={`Remove prescription ${i + 1}`}
              >
                <Trash2Icon aria-hidden="true" />
              </Button>
            </fieldset>
          );
        })}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => rx.append({ stockItemId: "", dose: "", quantity: 1 })}
          disabled={rx.fields.length >= LIMITS.prescriptions}
        >
          <PlusIcon aria-hidden="true" />
          Add item
        </Button>
        <FieldError errors={[errors.prescriptions?.root]} />
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-semibold">
          Lab requests{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({labs.fields.length} of {LIMITS.labRequests})
          </span>
        </legend>
        {labs.fields.length === 0 && (
          <p className="text-sm text-muted-foreground">No tests requested.</p>
        )}
        {labs.fields.map((field, i) => {
          const e = errors.labRequests?.[i];
          return (
            <fieldset
              key={field.id}
              className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_auto] sm:items-start"
              data-testid="lab-row"
            >
              <legend className="sr-only">Lab request {i + 1}</legend>
              <Field data-invalid={!!e?.testId}>
                <FieldLabel htmlFor={`lab-${i}-test`}>Test</FieldLabel>
                <Controller
                  control={control}
                  name={`labRequests.${i}.testId`}
                  render={({ field: f }) => (
                    <Select value={f.value} onValueChange={f.onChange}>
                      <SelectTrigger
                        id={`lab-${i}-test`}
                        className="w-full"
                        aria-invalid={!!e?.testId}
                        onBlur={f.onBlur}
                      >
                        <SelectValue placeholder="Choose a test" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {testsSorted.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name} · {formatNaira(t.priceKobo)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError errors={[e?.testId]} />
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="sm:mt-6"
                onClick={() => labs.remove(i)}
                aria-label={`Remove lab request ${i + 1}`}
              >
                <Trash2Icon aria-hidden="true" />
              </Button>
            </fieldset>
          );
        })}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => labs.append({ testId: "" })}
          disabled={labs.fields.length >= LIMITS.labRequests}
        >
          <PlusIcon aria-hidden="true" />
          Add test
        </Button>
      </fieldset>

      <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
        {editing && (
          <Button
            type="button"
            variant="outline"
            onClick={onDone}
            disabled={submitting}
          >
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting && (
            <Loader2Icon className="animate-spin" aria-hidden="true" />
          )}
          {editing ? "Save changes" : "Save and complete visit"}
        </Button>
      </div>
    </form>
  );
}
