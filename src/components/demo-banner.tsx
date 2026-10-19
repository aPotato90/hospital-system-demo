import { TriangleAlertIcon } from "lucide-react";

export const DEMO_WARNING =
  "Demo. Fake data only. Do not enter real personal or medical information.";

/** Shown at the top of every page by the root layout. */
export function DemoBanner() {
  return (
    <aside
      aria-label="Demo notice"
      data-print-hide
      className="border-b border-black/5 bg-banner px-4 py-2 text-center text-sm font-medium text-banner-foreground dark:border-white/10"
    >
      <p className="mx-auto flex max-w-5xl items-center justify-center gap-2">
        <TriangleAlertIcon className="size-4 shrink-0" aria-hidden="true" />
        <span>{DEMO_WARNING}</span>
      </p>
    </aside>
  );
}
