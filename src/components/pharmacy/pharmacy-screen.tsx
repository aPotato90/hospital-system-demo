"use client";

import { useSearchParams } from "next/navigation";
import { DemoWorkflowNote } from "@/components/clinical/demo-workflow-note";
import { PageHeader } from "@/components/app/page-header";
import { RoleGate } from "@/components/app/role-gate";
import { useUrlUpdate } from "@/hooks/use-url-update";
import { cn } from "@/lib/utils";
import { DispenseQueue } from "./dispense-queue";
import { StockList } from "./stock-list";

const TABS = [
  { key: "queue", label: "Dispensing queue" },
  { key: "stock", label: "Stock" },
] as const;

export function PharmacyScreen() {
  const searchParams = useSearchParams();
  const updateUrl = useUrlUpdate();
  const tab = searchParams.get("tab") === "stock" ? "stock" : "queue";

  return (
    <RoleGate>
      <PageHeader
        title="Pharmacy"
        description="Dispense pending prescriptions and keep the (fictional) stock list."
      />
      <div className="mt-4">
        <DemoWorkflowNote>
          A demo workflow, not pharmacy software. There are no dose or
          interaction checks; the allergy flag is a plain text match on fake
          data.
        </DemoWorkflowNote>
      </div>
      <nav aria-label="Pharmacy sections" className="mt-6">
        <ul className="inline-flex rounded-lg bg-muted p-0.5">
          {TABS.map((t) => (
            <li key={t.key}>
              <button
                type="button"
                aria-current={tab === t.key ? "page" : undefined}
                onClick={() =>
                  updateUrl(t.key === "stock" ? "?tab=stock" : "", "push")
                }
                className={cn(
                  "h-8 rounded-md px-3 text-sm font-medium focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  tab === t.key
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <section
        aria-label={TABS.find((t) => t.key === tab)!.label}
        className="mt-4"
      >
        {tab === "queue" ? <DispenseQueue /> : <StockList />}
      </section>
    </RoleGate>
  );
}
