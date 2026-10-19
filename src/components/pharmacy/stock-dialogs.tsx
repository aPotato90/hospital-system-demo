"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  createStockItem,
  receiveStock,
  updateStockItem,
} from "@/lib/hms/clinical-actions";
import { LIMITS } from "@/lib/hms/common";
import { useSandbox } from "@/lib/hms/sandbox-context";
import {
  makeReceiveStockSchema,
  stockItemFormSchema,
  type StockItem,
  type StockItemFormValues,
} from "@/lib/hms/stock-item";

/** Add a stock item, or edit one's details (the count changes elsewhere). */
export function StockItemDialog({
  open,
  onOpenChange,
  item,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: StockItem;
  categories: string[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        {open && (
          <StockItemForm
            item={item}
            categories={categories}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function StockItemForm({
  item,
  categories,
  onDone,
}: {
  item?: StockItem;
  categories: string[];
  onDone: () => void;
}) {
  const sandbox = useSandbox();
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<StockItemFormValues>({
    resolver: zodResolver(stockItemFormSchema),
    defaultValues: item
      ? {
          name: item.name,
          category: item.category,
          unit: item.unit,
          reorderLevel: item.reorderLevel,
          unitPriceNaira: item.unitPriceKobo / 100,
          quantity: item.quantity,
        }
      : {
          name: "",
          category: "",
          unit: "",
          reorderLevel: 0,
          unitPriceNaira: 0,
          quantity: 0,
        },
    mode: "onTouched",
  });
  const { register, handleSubmit, formState } = form;
  const errors = formState.errors;

  async function onSubmit(values: StockItemFormValues) {
    setSubmitting(true);
    try {
      if (item) {
        await updateStockItem(sandbox, item, values);
        toast.success(`${values.name} updated`);
      } else {
        await createStockItem(sandbox, values);
        toast.success(`${values.name} added to stock`);
      }
      onDone();
    } catch {
      toast.error("Could not save the stock item. Try again.");
      setSubmitting(false);
    }
  }

  const text = (
    name: "name" | "category" | "unit",
    label: string,
    max: number,
  ) => (
    <Field data-invalid={!!errors[name]}>
      <FieldLabel htmlFor={`stock-${name}`}>{label}</FieldLabel>
      <Input
        id={`stock-${name}`}
        autoComplete="off"
        maxLength={max}
        aria-invalid={!!errors[name]}
        list={name === "category" ? "stock-categories" : undefined}
        {...register(name)}
      />
      <FieldError errors={[errors[name]]} />
    </Field>
  );
  const number = (
    name: "reorderLevel" | "unitPriceNaira" | "quantity",
    label: string,
    step: string,
  ) => (
    <Field data-invalid={!!errors[name]}>
      <FieldLabel htmlFor={`stock-${name}`}>{label}</FieldLabel>
      <Input
        id={`stock-${name}`}
        type="number"
        inputMode={step === "1" ? "numeric" : "decimal"}
        min={0}
        step={step}
        aria-invalid={!!errors[name]}
        {...register(name, { valueAsNumber: true })}
      />
      <FieldError errors={[errors[name]]} />
    </Field>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{item ? "Edit stock item" : "Add stock item"}</DialogTitle>
        <DialogDescription>
          {item
            ? "Change the details. Use Receive stock to change the count."
            : "Prices are in naira. All items are fictional demo stock."}
        </DialogDescription>
      </DialogHeader>
      <FakeDataWarning />
      {text("name", "Name", LIMITS.name)}
      <div className="grid gap-4 sm:grid-cols-2">
        {text("category", "Category", LIMITS.label)}
        {text("unit", "Unit (e.g. tablet, bottle)", LIMITS.label)}
      </div>
      <datalist id="stock-categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <div className="grid gap-4 sm:grid-cols-3">
        {number("unitPriceNaira", "Unit price (₦)", "0.01")}
        {number("reorderLevel", "Reorder level", "1")}
        {!item && number("quantity", "Opening quantity", "1")}
      </div>
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
          {item ? "Save changes" : "Add item"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Record a delivery: increases the count by the received quantity. */
export function ReceiveStockDialog({
  item,
  onClose,
}: {
  item: StockItem | null;
  onClose: () => void;
}) {
  const sandbox = useSandbox();
  const [submitting, setSubmitting] = useState(false);
  const schema = useMemo(
    () => makeReceiveStockSchema(item?.quantity ?? 0),
    [item],
  );
  const form = useForm<{ received: number }>({
    resolver: zodResolver(schema),
    defaultValues: { received: 1 },
    mode: "onTouched",
  });
  const errors = form.formState.errors;

  async function onSubmit({ received }: { received: number }) {
    if (!item) return;
    setSubmitting(true);
    try {
      await receiveStock(sandbox, item, received);
      toast.success(`Received ${received} ${item.unit}(s) of ${item.name}`);
      onClose();
    } catch {
      toast.error("Could not record the delivery. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && !submitting && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="grid gap-4"
        >
          <DialogHeader>
            <DialogTitle>Receive stock</DialogTitle>
            <DialogDescription>
              {item?.name}: {item?.quantity} {item?.unit}(s) on hand now.
            </DialogDescription>
          </DialogHeader>
          <Field data-invalid={!!errors.received}>
            <FieldLabel htmlFor="receive-qty">Quantity received</FieldLabel>
            <Input
              id="receive-qty"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              aria-invalid={!!errors.received}
              {...form.register("received", { valueAsNumber: true })}
            />
            <FieldError errors={[errors.received]} />
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
              Receive
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
