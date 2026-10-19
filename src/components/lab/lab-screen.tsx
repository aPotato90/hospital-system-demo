"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, SearchIcon, Undo2Icon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { StatusBadge } from "@/components/appointments/status-badge";
import { DemoWorkflowNote } from "@/components/clinical/demo-workflow-note";
import { FakeDataWarning } from "@/components/fake-data-warning";
import { ErrorState, ListSkeleton } from "@/components/app/live-state";
import { PageHeader } from "@/components/app/page-header";
import { RoleGate } from "@/components/app/role-gate";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { useUrlUpdate } from "@/hooks/use-url-update";
import { formatDateTime } from "@/lib/format";
import {
  collectLabSample,
  recordLabResult,
  undoLabResult,
} from "@/lib/hms/clinical-actions";
import { LIMITS } from "@/lib/hms/common";
import { useById, useCollection } from "@/lib/hms/hooks";
import type { LabOrder } from "@/lib/hms/lab-order";
import {
  countLabOrdersByStatus,
  filterLabOrders,
  orderedAt,
  type LabFilter,
} from "@/lib/hms/lab-query";
import { useSandbox } from "@/lib/hms/sandbox-context";
import {
  LAB_ORDER_STATUS_LABELS,
  LAB_ORDER_STATUSES,
  type LabOrderStatus,
} from "@/lib/hms/transitions";
import { cn } from "@/lib/utils";

const ALL = "all";

function parseLabFilter(params: URLSearchParams): LabFilter {
  const status = params.get("status");
  const date = params.get("date");
  return {
    status: (LAB_ORDER_STATUSES as readonly string[]).includes(status ?? "")
      ? (status as LabOrderStatus)
      : "requested",
    testId: params.get("test"),
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    q: (params.get("q") ?? "").slice(0, 100),
  };
}

function labSearch(f: LabFilter) {
  const out = new URLSearchParams();
  if (f.status !== "requested") out.set("status", f.status);
  if (f.testId) out.set("test", f.testId);
  if (f.date) out.set("date", f.date);
  if (f.q) out.set("q", f.q);
  const s = out.toString();
  return s ? `?${s}` : "";
}

const resultSchema = z.object({
  resultText: z
    .string()
    .trim()
    .min(1, "Enter the result")
    .max(LIMITS.text, `At most ${LIMITS.text} characters`),
});

function ResultDialog({
  order,
  patientName,
  onClose,
}: {
  order: LabOrder | null;
  patientName: string;
  onClose: () => void;
}) {
  const sandbox = useSandbox();
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<{ resultText: string }>({
    resolver: zodResolver(resultSchema),
    defaultValues: { resultText: "" },
    mode: "onTouched",
  });
  const errors = form.formState.errors;

  async function onSubmit({ resultText }: { resultText: string }) {
    if (!order) return;
    setSubmitting(true);
    try {
      await recordLabResult(sandbox, order, resultText);
      toast.success(`${order.name} resulted for ${patientName}`);
      form.reset();
      onClose();
    } catch {
      toast.error("Could not save the result. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && !submitting && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="grid gap-4"
        >
          <DialogHeader>
            <DialogTitle>Enter result</DialogTitle>
            <DialogDescription>
              {order?.name} for {patientName}. Saving marks the order resulted.
            </DialogDescription>
          </DialogHeader>
          <FakeDataWarning />
          <Field data-invalid={!!errors.resultText}>
            <FieldLabel htmlFor="lab-result">Result</FieldLabel>
            <Textarea
              id="lab-result"
              rows={5}
              maxLength={LIMITS.text}
              aria-invalid={!!errors.resultText}
              aria-describedby="lab-result-hint"
              {...form.register("resultText")}
            />
            <FieldDescription id="lab-result-hint">
              Free text, up to {LIMITS.text.toLocaleString("en-NG")} characters.
              Made-up values only.
            </FieldDescription>
            <FieldError errors={[errors.resultText]} />
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && (
                <Loader2Icon className="animate-spin" aria-hidden="true" />
              )}
              Mark resulted
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LabScreen() {
  const sandbox = useSandbox();
  const searchParams = useSearchParams();
  const filter = parseLabFilter(new URLSearchParams(searchParams.toString()));
  const updateUrl = useUrlUpdate();
  const orders = useCollection("labOrders");
  const patients = useCollection("patients");
  const consultations = useCollection("consultations");
  const tests = useCollection("labTests");
  const patientById = useById(patients.data);
  const consultationById = useById(consultations.data);
  const [text, setText] = useState(filter.q);
  const [resulting, setResulting] = useState<LabOrder | null>(null);
  const [undoing, setUndoing] = useState<LabOrder | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const isAdmin = sandbox.role === "admin";

  const go = (next: Partial<LabFilter>) =>
    updateUrl(labSearch({ ...filter, ...next }));
  const counts = countLabOrdersByStatus(orders.data ?? []);
  const rows = useMemo(
    () =>
      filterLabOrders(orders.data ?? [], filter, patientById, consultationById),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      orders.data,
      patientById,
      consultationById,
      filter.status,
      filter.testId,
      filter.date,
      filter.q,
    ],
  );
  const name = (o: LabOrder) => {
    const p = patientById.get(o.patientId);
    return p ? `${p.firstName} ${p.lastName}` : "Unknown patient";
  };

  async function collect(o: LabOrder) {
    setBusyId(o.id);
    try {
      await collectLabSample(sandbox, o);
      toast.success(`Sample collected: ${o.name} for ${name(o)}`);
    } catch {
      toast.error("Could not mark the sample collected.");
    } finally {
      setBusyId(null);
    }
  }

  async function undo() {
    const o = undoing;
    if (!o) return;
    setUndoing(null);
    setBusyId(o.id);
    try {
      await undoLabResult(sandbox, o);
      toast.success(
        `Result undone: ${o.name} for ${name(o)} is back to collected`,
      );
    } catch {
      toast.error("Could not undo the result.");
    } finally {
      setBusyId(null);
    }
  }

  const failed =
    orders.error ?? patients.error ?? consultations.error ?? tests.error;
  const loading =
    orders.loading ||
    patients.loading ||
    consultations.loading ||
    tests.loading;

  return (
    <RoleGate>
      <PageHeader
        title="Lab orders"
        description="Collect samples and record (fake) results, oldest request first."
      />
      <div className="mt-4">
        <DemoWorkflowNote>
          A demo workflow, not laboratory software. Results are free text typed
          by hand and fake; nothing is interpreted or flagged.
        </DemoWorkflowNote>
      </div>

      <div
        role="group"
        aria-label="Status"
        className="mt-6 inline-flex flex-wrap rounded-lg bg-muted p-0.5"
      >
        {LAB_ORDER_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={filter.status === s}
            onClick={() => go({ status: s })}
            className={cn(
              "h-8 rounded-md px-3 text-sm font-medium focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              filter.status === s
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {LAB_ORDER_STATUS_LABELS[s]} ({counts[s]})
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="relative">
          <label
            htmlFor="lab-search"
            className="mb-1.5 block text-sm font-medium"
          >
            Search patient
          </label>
          <SearchIcon
            className="pointer-events-none absolute bottom-2 left-2.5 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="lab-search"
            type="search"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              go({ q: e.target.value.trimStart() });
            }}
            placeholder="Name or patient number"
            className="h-9 pl-8"
            autoComplete="off"
            maxLength={100}
          />
        </div>
        <div>
          <label
            htmlFor="lab-test"
            className="mb-1.5 block text-sm font-medium"
          >
            Test
          </label>
          <Select
            value={filter.testId ?? ALL}
            onValueChange={(v) => go({ testId: v === ALL ? null : v })}
          >
            <SelectTrigger id="lab-test" className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All tests</SelectItem>
              {(tests.data ?? [])
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label
            htmlFor="lab-date"
            className="mb-1.5 block text-sm font-medium"
          >
            Ordered on
          </label>
          <div className="flex gap-2">
            <Input
              id="lab-date"
              type="date"
              value={filter.date ?? ""}
              onChange={(e) => go({ date: e.target.value || null })}
              className="h-9"
            />
            {filter.date && (
              <Button
                variant="outline"
                className="h-9"
                onClick={() => go({ date: null })}
              >
                Any day
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4">
        {failed ? (
          <ErrorState
            error={failed}
            onRetry={() =>
              [orders, patients, consultations, tests].forEach((l) => l.retry())
            }
          />
        ) : loading ? (
          <ListSkeleton rows={4} />
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No {LAB_ORDER_STATUS_LABELS[filter.status].toLowerCase()} orders
            match.
          </p>
        ) : (
          <ul
            className="space-y-2"
            aria-label={`${LAB_ORDER_STATUS_LABELS[filter.status]} lab orders`}
          >
            {rows.map((o) => {
              const p = patientById.get(o.patientId);
              const at = orderedAt(o, consultationById);
              return (
                <li
                  key={o.id}
                  data-testid="lab-row"
                  className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {o.name} · {name(o)}
                      {p && (
                        <span className="ml-2 font-mono text-xs text-muted-foreground">
                          {p.patientNo}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Ordered {at ? formatDateTime(at) : "—"}
                      {o.resultedAt &&
                        ` · Resulted ${formatDateTime(o.resultedAt)}`}
                    </p>
                    {o.status === "resulted" && (
                      <p className="mt-1 text-sm whitespace-pre-line">
                        {o.resultText}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={o.status} />
                    {o.status === "requested" && (
                      <Button
                        size="sm"
                        onClick={() => collect(o)}
                        disabled={busyId === o.id}
                        aria-label={`Mark collected: ${o.name} for ${name(o)}`}
                      >
                        Mark collected
                      </Button>
                    )}
                    {o.status === "collected" && (
                      <Button
                        size="sm"
                        onClick={() => setResulting(o)}
                        disabled={busyId === o.id}
                        aria-label={`Enter result: ${o.name} for ${name(o)}`}
                      >
                        Enter result
                      </Button>
                    )}
                    {o.status === "resulted" && isAdmin && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setUndoing(o)}
                        disabled={busyId === o.id}
                        aria-label={`Undo result: ${o.name} for ${name(o)}`}
                      >
                        <Undo2Icon aria-hidden="true" />
                        Undo result
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {filter.status === "resulted" && !isAdmin && rows.length > 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            Resulted orders are read-only. In this demo only Admin can undo a
            result.
          </p>
        )}
      </div>

      <ResultDialog
        key={resulting?.id ?? "none"}
        order={resulting}
        patientName={resulting ? name(resulting) : ""}
        onClose={() => setResulting(null)}
      />
      <AlertDialog
        open={!!undoing}
        onOpenChange={(o) => !o && setUndoing(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Undo this result?</AlertDialogTitle>
            <AlertDialogDescription>
              {undoing?.name} for {undoing ? name(undoing) : ""} goes back to
              collected and the result text is cleared. The undo is recorded in
              the audit trail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep result</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={undo}>
              Undo result
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RoleGate>
  );
}
