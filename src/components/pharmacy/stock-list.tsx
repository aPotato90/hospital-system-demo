"use client";

import {
  AlertTriangleIcon,
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  MoreHorizontalIcon,
  PackagePlusIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ErrorState, ListSkeleton } from "@/components/app/live-state";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUrlUpdate } from "@/hooks/use-url-update";
import { deleteStockItem, restoreStockItem } from "@/lib/hms/clinical-actions";
import { useCollection } from "@/lib/hms/hooks";
import { formatNaira } from "@/lib/hms/money";
import { useSandbox } from "@/lib/hms/sandbox-context";
import {
  isLowStock,
  queryStock,
  STOCK_SORTS,
  stockValueKobo,
  type StockFilter,
  type StockItem,
  type StockSort,
} from "@/lib/hms/stock-item";
import { cn } from "@/lib/utils";
import { ReceiveStockDialog, StockItemDialog } from "./stock-dialogs";

const ALL = "all";
const UNDO_MS = 10_000;

const SORT_LABELS: Record<StockSort, string> = {
  name: "Name",
  category: "Category",
  quantity: "On hand",
  unitPrice: "Unit price",
  value: "Stock value",
};

function parseStockFilter(params: URLSearchParams): StockFilter {
  const sort = params.get("sort");
  return {
    q: (params.get("q") ?? "").slice(0, 100),
    category: params.get("category"),
    lowOnly: params.get("low") === "1",
    sort: (STOCK_SORTS as readonly string[]).includes(sort ?? "")
      ? (sort as StockSort)
      : "name",
    dir: params.get("dir") === "desc" ? "desc" : "asc",
  };
}

function stockSearch(f: StockFilter) {
  const out = new URLSearchParams({ tab: "stock" });
  if (f.q) out.set("q", f.q);
  if (f.category) out.set("category", f.category);
  if (f.lowOnly) out.set("low", "1");
  if (f.sort !== "name") out.set("sort", f.sort);
  if (f.dir !== "asc") out.set("dir", f.dir);
  return `?${out.toString()}`;
}

function LowStock({ item }: { item: StockItem }) {
  if (!isLowStock(item)) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
      <AlertTriangleIcon className="size-3.5" aria-hidden="true" />
      Low stock
    </span>
  );
}

export function StockList() {
  const sandbox = useSandbox();
  const searchParams = useSearchParams();
  const filter = parseStockFilter(new URLSearchParams(searchParams.toString()));
  const updateUrl = useUrlUpdate();
  const stock = useCollection("stockItems");
  const pending = useCollection("prescriptions", {
    where: [["status", "==", "pending"]],
  });
  const [text, setText] = useState(filter.q);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<StockItem | null>(null);
  const [receiving, setReceiving] = useState<StockItem | null>(null);

  const go = (next: Partial<StockFilter>) =>
    updateUrl(stockSearch({ ...filter, ...next }));
  const categories = useMemo(
    () => [...new Set((stock.data ?? []).map((s) => s.category))].sort(),
    [stock.data],
  );
  const rows = useMemo(
    () => queryStock(stock.data ?? [], filter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      stock.data,
      filter.q,
      filter.category,
      filter.lowOnly,
      filter.sort,
      filter.dir,
    ],
  );
  const lowCount = (stock.data ?? []).filter(isLowStock).length;

  const onSort = (sort: StockSort) =>
    go({
      sort,
      dir: filter.sort === sort && filter.dir === "asc" ? "desc" : "asc",
    });

  async function remove(item: StockItem) {
    const needed = (pending.data ?? []).filter(
      (p) => p.stockItemId === item.id,
    ).length;
    if (needed > 0) {
      toast.error(
        `${item.name} is on ${needed} pending prescription${needed === 1 ? "" : "s"}. Dispense or change them first.`,
      );
      return;
    }
    try {
      await deleteStockItem(sandbox, item);
    } catch {
      toast.error("Could not delete the item.");
      return;
    }
    toast(`${item.name} deleted`, {
      duration: UNDO_MS,
      action: {
        label: "Undo",
        onClick: async () => {
          try {
            await restoreStockItem(sandbox, item);
            toast.success(`${item.name} restored`);
          } catch {
            toast.error("Could not restore the item.");
          }
        },
      },
    });
  }

  const actions = (s: StockItem) => (
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        variant="outline"
        onClick={() => setReceiving(s)}
        aria-label={`Receive stock: ${s.name}`}
      >
        <PackagePlusIcon aria-hidden="true" />
        Receive
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`More actions: ${s.name}`}
          >
            <MoreHorizontalIcon aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditing(s)}>
            Edit details
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => remove(s)}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const sortHeader = (sort: StockSort, className?: string) => {
    const active = filter.sort === sort;
    const Icon = !active
      ? ArrowUpDownIcon
      : filter.dir === "asc"
        ? ArrowUpIcon
        : ArrowDownIcon;
    return (
      <th
        scope="col"
        aria-sort={
          active ? (filter.dir === "asc" ? "ascending" : "descending") : "none"
        }
        className={cn("px-3 py-2 font-medium", className)}
      >
        <button
          type="button"
          onClick={() => onSort(sort)}
          className="-mx-1 inline-flex items-center gap-1 rounded px-1 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {SORT_LABELS[sort]}
          <Icon className="size-3.5" aria-hidden="true" />
        </button>
      </th>
    );
  };

  return (
    <div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="relative flex-1">
          <label
            htmlFor="stock-search"
            className="mb-1.5 block text-sm font-medium"
          >
            Search stock
          </label>
          <SearchIcon
            className="pointer-events-none absolute bottom-2 left-2.5 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="stock-search"
            type="search"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              go({ q: e.target.value.trimStart() });
            }}
            placeholder="Item or category"
            className="h-9 pl-8"
            autoComplete="off"
            maxLength={100}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:w-[34rem]">
          <div>
            <label
              htmlFor="stock-category"
              className="mb-1.5 block text-sm font-medium"
            >
              Category
            </label>
            <Select
              value={filter.category ?? ALL}
              onValueChange={(v) => go({ category: v === ALL ? null : v })}
            >
              <SelectTrigger id="stock-category" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:hidden">
            <label
              htmlFor="stock-sort"
              className="mb-1.5 block text-sm font-medium"
            >
              Sort by
            </label>
            <Select
              value={`${filter.sort}:${filter.dir}`}
              onValueChange={(v) => {
                const [sort, dir] = v.split(":") as [StockSort, "asc" | "desc"];
                go({ sort, dir });
              }}
            >
              <SelectTrigger id="stock-sort" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STOCK_SORTS.flatMap((s) =>
                  (["asc", "desc"] as const).map((d) => (
                    <SelectItem key={`${s}:${d}`} value={`${s}:${d}`}>
                      {SORT_LABELS[s]} (
                      {d === "asc" ? "low to high" : "high to low"})
                    </SelectItem>
                  )),
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2 sm:col-span-2 md:col-span-2">
            <Button
              variant={filter.lowOnly ? "default" : "outline"}
              className="h-9"
              aria-pressed={filter.lowOnly}
              onClick={() => go({ lowOnly: !filter.lowOnly })}
            >
              <AlertTriangleIcon aria-hidden="true" />
              Low stock ({lowCount})
            </Button>
            <Button className="h-9" onClick={() => setAdding(true)}>
              <PlusIcon aria-hidden="true" />
              Add item
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4">
        {stock.error ? (
          <ErrorState error={stock.error} onRetry={stock.retry} />
        ) : stock.loading ? (
          <ListSkeleton />
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No stock items match.
          </p>
        ) : (
          <>
            <p
              className="mb-2 text-sm text-muted-foreground"
              aria-live="polite"
            >
              {rows.length} items · value on hand{" "}
              {formatNaira(rows.reduce((s, r) => s + stockValueKobo(r), 0))}
            </p>
            <ul className="space-y-2 md:hidden" aria-label="Stock items">
              {rows.map((s) => (
                <li
                  key={s.id}
                  className="rounded-xl border bg-card p-3"
                  data-testid="stock-card"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{s.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {s.category} · {formatNaira(s.unitPriceKobo)} per{" "}
                        {s.unit}
                      </p>
                    </div>
                    {actions(s)}
                  </div>
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    <span className="tabular-nums">
                      {s.quantity} {s.unit}(s) on hand · reorder at{" "}
                      {s.reorderLevel}
                    </span>
                    <LowStock item={s} />
                  </p>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Stock items, sorted by{" "}
                  {SORT_LABELS[filter.sort].toLowerCase()}
                </caption>
                <thead className="border-b bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    {sortHeader("name")}
                    {sortHeader("category")}
                    {sortHeader("quantity", "text-right")}
                    <th
                      scope="col"
                      className="px-3 py-2 text-right font-medium"
                    >
                      Reorder at
                    </th>
                    {sortHeader("unitPrice", "text-right")}
                    {sortHeader("value", "text-right")}
                    <th scope="col" className="px-3 py-2 font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-3 py-2">
                        <span className="font-medium">{s.name}</span>
                        <span className="ml-2 align-middle">
                          <LowStock item={s} />
                        </span>
                      </td>
                      <td className="px-3 py-2">{s.category}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                        {s.quantity} {s.unit}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {s.reorderLevel}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatNaira(s.unitPriceKobo)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatNaira(stockValueKobo(s))}
                      </td>
                      <td className="px-3 py-2">{actions(s)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <StockItemDialog
        open={adding}
        onOpenChange={setAdding}
        categories={categories}
      />
      <StockItemDialog
        key={editing?.id ?? "none"}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        item={editing ?? undefined}
        categories={categories}
      />
      <ReceiveStockDialog
        key={receiving?.id ?? "none"}
        item={receiving}
        onClose={() => setReceiving(null)}
      />
    </div>
  );
}
