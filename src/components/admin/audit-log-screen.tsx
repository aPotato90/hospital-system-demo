"use client";

import { LockIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ErrorState, ListSkeleton } from "@/components/app/live-state";
import { PageHeader } from "@/components/app/page-header";
import { RoleGate } from "@/components/app/role-gate";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUrlUpdate } from "@/hooks/use-url-update";
import { formatDateTime } from "@/lib/format";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  type AuditAction,
  type AuditEntityType,
} from "@/lib/hms/audit-log";
import { useCollection } from "@/lib/hms/hooks";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/hms/roles";

const ALL = "all";
const PAGE = 50;

const ENTITY_LABELS: Record<AuditEntityType, string> = {
  patient: "Patient",
  appointment: "Appointment",
  consultation: "Consultation",
  labOrder: "Lab order",
  prescription: "Prescription",
  invoice: "Invoice",
  stockItem: "Stock item",
  staff: "Staff",
  sandbox: "Sandbox",
};

type Filter = {
  action: AuditAction | null;
  role: Role | null;
  entity: AuditEntityType | null;
};

function pick<T extends string>(
  value: string | null,
  options: readonly T[],
): T | null {
  return value && (options as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

export function AuditLogScreen() {
  const searchParams = useSearchParams();
  const updateUrl = useUrlUpdate();
  const action = pick(searchParams.get("action"), AUDIT_ACTIONS);
  const role = pick(searchParams.get("role"), ROLES);
  const entity = pick(searchParams.get("entity"), AUDIT_ENTITY_TYPES);
  const filter: Filter = { action, role, entity };
  const go = (next: Partial<Filter>) => {
    const f = { ...filter, ...next };
    const out = new URLSearchParams();
    if (f.action) out.set("action", f.action);
    if (f.role) out.set("role", f.role);
    if (f.entity) out.set("entity", f.entity);
    const s = out.toString();
    updateUrl(s ? `?${s}` : "");
  };
  const entries = useCollection("auditLog", { orderBy: [["at", "desc"]] });
  const [shown, setShown] = useState(PAGE);
  const rows = (entries.data ?? []).filter(
    (e) =>
      (!action || e.action === action) &&
      (!role || e.actorRole === role) &&
      (!entity || e.entityType === entity),
  );

  const select = <T extends string>(
    id: string,
    label: string,
    value: T | null,
    options: readonly T[],
    labelFor: (v: T) => string,
    onChange: (v: T | null) => void,
  ) => (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <Select
        value={value ?? ALL}
        onValueChange={(v) => onChange(v === ALL ? null : (v as T))}
      >
        <SelectTrigger id={id} className="h-9 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectItem value={ALL}>All</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {labelFor(o)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <RoleGate>
      <PageHeader
        title="Audit log"
        description="Every recorded action in this sandbox, newest first."
      />
      <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
        <LockIcon className="size-4" aria-hidden="true" />
        Read-only and append-only: the security rules allow new entries but
        never changes or deletions. Entries stay after a reset or sign-out.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {select(
          "audit-action",
          "Action",
          filter.action,
          AUDIT_ACTIONS,
          (a) => AUDIT_ACTION_LABELS[a],
          (action) => go({ action }),
        )}
        {select(
          "audit-role",
          "Role",
          filter.role,
          ROLES,
          (r) => ROLE_LABELS[r],
          (role) => go({ role }),
        )}
        {select(
          "audit-entity",
          "Record type",
          filter.entity,
          AUDIT_ENTITY_TYPES,
          (e) => ENTITY_LABELS[e],
          (entity) => go({ entity }),
        )}
      </div>
      <div className="mt-4">
        {entries.error ? (
          <ErrorState error={entries.error} onRetry={entries.retry} />
        ) : entries.loading ? (
          <ListSkeleton />
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No entries match.
          </p>
        ) : (
          <>
            <p
              className="mb-2 text-sm text-muted-foreground"
              aria-live="polite"
            >
              {rows.length} entries
            </p>
            <ol
              className="divide-y rounded-xl border bg-card"
              aria-label="Audit entries"
            >
              {rows.slice(0, shown).map((e) => (
                <li
                  key={e.id}
                  className="flex flex-col gap-1 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <span>
                    <span className="font-medium">
                      {AUDIT_ACTION_LABELS[e.action]}
                    </span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {ENTITY_LABELS[e.entityType]}{" "}
                      <span className="font-mono text-xs">
                        {e.entityId.slice(0, 10)}
                      </span>{" "}
                      · as {ROLE_LABELS[e.actorRole]}
                    </span>
                  </span>
                  <time
                    dateTime={e.at.toISOString()}
                    className="text-muted-foreground"
                  >
                    {formatDateTime(e.at)}
                  </time>
                </li>
              ))}
            </ol>
            {rows.length > shown && (
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => setShown((n) => n + PAGE)}
              >
                Show more
              </Button>
            )}
          </>
        )}
      </div>
    </RoleGate>
  );
}
