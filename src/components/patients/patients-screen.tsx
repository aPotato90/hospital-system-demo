"use client";

import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
  UserPlusIcon,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ErrorState, ListSkeleton } from "@/components/app/live-state";
import { PageHeader } from "@/components/app/page-header";
import { RoleGate } from "@/components/app/role-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUrlUpdate } from "@/hooks/use-url-update";
import { formatAge, formatDate } from "@/lib/format";
import { useCollection } from "@/lib/hms/hooks";
import {
  parsePatientListParams,
  patientListSearch,
  queryPatients,
  type PatientListParams,
  type PatientSort,
} from "@/lib/hms/patient-query";
import { cn } from "@/lib/utils";
import { PatientFormDialog } from "./patient-form-dialog";

const SORT_LABELS: Record<PatientSort, string> = {
  name: "Name",
  patientNo: "Patient number",
  registered: "Date registered",
};

function SortHeader({
  label,
  sortKey,
  params,
  onSort,
  className,
}: {
  label: string;
  sortKey: PatientSort;
  params: PatientListParams;
  onSort: (sort: PatientSort) => void;
  className?: string;
}) {
  const active = params.sort === sortKey;
  const Icon = !active
    ? ArrowUpDownIcon
    : params.dir === "asc"
      ? ArrowUpIcon
      : ArrowDownIcon;
  return (
    <th
      scope="col"
      aria-sort={
        active ? (params.dir === "asc" ? "ascending" : "descending") : "none"
      }
      className={cn("px-3 py-2 text-left font-medium", className)}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="-mx-1 inline-flex items-center gap-1 rounded px-1 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {label}
        <Icon className="size-3.5" aria-hidden="true" />
        <span className="sr-only">
          {active
            ? `, sorted ${params.dir === "asc" ? "ascending" : "descending"}`
            : ", sort"}
        </span>
      </button>
    </th>
  );
}

export function PatientsScreen() {
  const searchParams = useSearchParams();
  const params = parsePatientListParams(
    new URLSearchParams(searchParams.toString()),
  );
  const updateUrl = useUrlUpdate();
  const patients = useCollection("patients");
  const [registerOpen, setRegisterOpen] = useState(false);

  // The search box is local state written straight to the URL; back/forward
  // navigation brings the URL value back into the box.
  const [text, setText] = useState(params.q);
  useEffect(() => {
    const onPop = () =>
      setText(new URLSearchParams(window.location.search).get("q") ?? "");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const result = useMemo(
    () => (patients.data ? queryPatients(patients.data, params) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [patients.data, params.q, params.sort, params.dir, params.page],
  );

  const go = (
    next: Partial<PatientListParams>,
    mode: "push" | "replace" = "replace",
  ) => updateUrl(patientListSearch({ ...params, ...next }), mode);

  const onSort = (sort: PatientSort) =>
    go({
      sort,
      dir: params.sort === sort && params.dir === "asc" ? "desc" : "asc",
      page: 1,
    });

  return (
    <RoleGate>
      <PageHeader
        title="Patients"
        description="The register of fake patients at Riverside Demo General Hospital."
        actions={
          <Button onClick={() => setRegisterOpen(true)}>
            <UserPlusIcon aria-hidden="true" />
            Register patient
          </Button>
        }
      />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="relative flex-1">
          <label
            htmlFor="patient-search"
            className="mb-1.5 block text-sm font-medium"
          >
            Search patients
          </label>
          <SearchIcon
            className="pointer-events-none absolute bottom-2 left-2.5 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="patient-search"
            type="search"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              go({ q: e.target.value.trimStart(), page: 1 });
            }}
            placeholder="Name, patient number or phone"
            className="h-9 pl-8"
            autoComplete="off"
            maxLength={100}
          />
        </div>
        <div className="md:hidden">
          <label
            htmlFor="patient-sort"
            className="mb-1.5 block text-sm font-medium"
          >
            Sort by
          </label>
          <Select
            value={`${params.sort}:${params.dir}`}
            onValueChange={(v) => {
              const [sort, dir] = v.split(":") as [PatientSort, "asc" | "desc"];
              go({ sort, dir, page: 1 });
            }}
          >
            <SelectTrigger id="patient-sort" className="h-9 w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABELS) as PatientSort[]).flatMap((s) =>
                (["asc", "desc"] as const).map((d) => (
                  <SelectItem key={`${s}:${d}`} value={`${s}:${d}`}>
                    {SORT_LABELS[s]} (
                    {d === "asc"
                      ? s === "registered"
                        ? "oldest"
                        : "A–Z"
                      : s === "registered"
                        ? "newest"
                        : "Z–A"}
                    )
                  </SelectItem>
                )),
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4">
        {patients.error ? (
          <ErrorState error={patients.error} onRetry={patients.retry} />
        ) : !result ? (
          <ListSkeleton />
        ) : (
          <>
            <p
              className="mb-2 text-sm text-muted-foreground"
              aria-live="polite"
            >
              {result.total === 0
                ? "No patients match your search."
                : `Showing ${result.from}–${result.to} of ${result.total} patients`}
            </p>

            {/* Cards on small screens */}
            <ul className="space-y-2 md:hidden" aria-label="Patients">
              {result.rows.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/app/patients/${p.id}`}
                    className="block rounded-xl border bg-card p-3 hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-medium">
                        {p.firstName} {p.lastName}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {p.patientNo}
                      </span>
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {formatAge(p.dateOfBirth)} ·{" "}
                      <span className="capitalize">{p.sex}</span> · {p.phone}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            {/* Table on larger screens */}
            <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Patients, sorted by {SORT_LABELS[params.sort].toLowerCase()} (
                  {params.dir === "asc" ? "ascending" : "descending"})
                </caption>
                <thead className="border-b bg-muted/50 text-muted-foreground">
                  <tr>
                    <SortHeader
                      label="Patient no."
                      sortKey="patientNo"
                      params={params}
                      onSort={onSort}
                    />
                    <SortHeader
                      label="Name"
                      sortKey="name"
                      params={params}
                      onSort={onSort}
                    />
                    <th scope="col" className="px-3 py-2 text-left font-medium">
                      Age / sex
                    </th>
                    <th scope="col" className="px-3 py-2 text-left font-medium">
                      Phone
                    </th>
                    <SortHeader
                      label="Registered"
                      sortKey="registered"
                      params={params}
                      onSort={onSort}
                    />
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-3 py-2.5 font-mono text-xs">
                        {p.patientNo}
                      </td>
                      <td className="px-3 py-2.5">
                        <Link
                          href={`/app/patients/${p.id}`}
                          className="rounded font-medium underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                        >
                          {p.lastName}, {p.firstName}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5">
                        {formatAge(p.dateOfBirth)} ·{" "}
                        <span className="capitalize">{p.sex}</span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {p.phone}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {formatDate(p.registeredAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {result.pageCount > 1 && (
              <nav
                aria-label="Pagination"
                className="mt-4 flex items-center justify-between gap-2"
              >
                <Button
                  variant="outline"
                  onClick={() => go({ page: result.page - 1 }, "push")}
                  disabled={result.page <= 1}
                >
                  <ChevronLeftIcon aria-hidden="true" />
                  Previous
                </Button>
                <p className="text-sm text-muted-foreground">
                  Page {result.page} of {result.pageCount}
                </p>
                <Button
                  variant="outline"
                  onClick={() => go({ page: result.page + 1 }, "push")}
                  disabled={result.page >= result.pageCount}
                >
                  Next
                  <ChevronRightIcon aria-hidden="true" />
                </Button>
              </nav>
            )}
          </>
        )}
      </div>

      <PatientFormDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        existingPatientNos={patients.data?.map((p) => p.patientNo) ?? []}
      />
    </RoleGate>
  );
}
