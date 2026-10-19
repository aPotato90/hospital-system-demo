import { InfoIcon } from "lucide-react";

/** States plainly that the clinical screens are a demo, not medical software. */
export function DemoWorkflowNote({ children }: { children?: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
      <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>
        {children ??
          "A demo workflow, not medical software. It gives no dose, diagnosis or drug-interaction suggestions; everything here is typed by hand and fake."}
      </span>
    </p>
  );
}
