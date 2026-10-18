import { TriangleAlertIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEMO_WARNING } from "./demo-banner";

/** Shown above every form that accepts free text. */
export function FakeDataWarning({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-lg bg-banner px-3 py-2 text-sm text-banner-foreground",
        className,
      )}
    >
      <TriangleAlertIcon
        className="mt-0.5 size-4 shrink-0"
        aria-hidden="true"
      />
      <span>{DEMO_WARNING}</span>
    </p>
  );
}
