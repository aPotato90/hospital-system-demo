import { HammerIcon } from "lucide-react";
import { PageHeader } from "./page-header";
import { RoleGate } from "./role-gate";

/** Placeholder for screens built in the next step. */
export function ComingSoon({
  title,
  description,
  planned,
}: {
  title: string;
  description: string;
  planned: string[];
}) {
  return (
    <RoleGate>
      <PageHeader title={title} description={description} />
      <section
        aria-labelledby="coming-heading"
        className="mt-6 rounded-xl border border-dashed bg-card p-6"
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex size-9 items-center justify-center rounded-full bg-muted">
            <HammerIcon className="size-4" aria-hidden="true" />
          </span>
          <h2 id="coming-heading" className="font-semibold">
            Coming in the next step
          </h2>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          The data for this screen is already in your sandbox. The screen itself
          will add:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {planned.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>
    </RoleGate>
  );
}
