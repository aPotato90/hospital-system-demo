"use client";

import { CheckCircle2Icon, CircleIcon, MapIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCollection } from "@/lib/hms/hooks";
import { journeyProgress, type JourneyStep } from "@/lib/hms/journey";
import { ROLE_LABELS } from "@/lib/hms/roles";
import { useSandbox } from "@/lib/hms/sandbox-context";

const DISMISS_KEY = "hms-journey-dismissed";

function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Guided walkthrough of the whole patient journey. Progress comes from the
 * sandbox's audit log (entries since the last seed); each step switches to
 * the right demo role and opens its screen. Dismissible, remembered per browser.
 */
export function DemoJourney() {
  const { meta, setRole } = useSandbox();
  const router = useRouter();
  const [dismissed, setDismissed] = useState(readDismissed);
  const since = meta.seededAt ?? new Date(0);
  const entries = useCollection("auditLog", { where: [["at", ">=", since]] });
  const progress = journeyProgress(entries.data ?? [], meta.seededAt);

  const persist = (value: boolean) => {
    setDismissed(value);
    try {
      if (value) localStorage.setItem(DISMISS_KEY, "1");
      else localStorage.removeItem(DISMISS_KEY);
    } catch {
      // Storage may be unavailable; the panel just reappears next time.
    }
  };

  async function go(step: JourneyStep) {
    await setRole(step.role);
    router.push(step.href);
  }

  if (dismissed) {
    return (
      <Button variant="outline" size="sm" onClick={() => persist(false)}>
        <MapIcon aria-hidden="true" />
        Show the demo journey
      </Button>
    );
  }

  return (
    <section
      aria-labelledby="journey-heading"
      className="rounded-xl border border-primary/30 bg-accent/40 p-4"
      data-testid="demo-journey"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="journey-heading" className="font-semibold">
            Demo journey
          </h2>
          <p className="text-sm text-muted-foreground">
            Follow one patient through the hospital. Each step switches to the
            right role (a UI demonstration only) and opens its screen.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => persist(true)}
          aria-label="Hide the demo journey"
        >
          <XIcon aria-hidden="true" />
        </Button>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div
          role="progressbar"
          aria-label="Demo journey progress"
          aria-valuemin={0}
          aria-valuemax={progress.steps.length}
          aria-valuenow={progress.completed}
          aria-valuetext={`${progress.completed} of ${progress.steps.length} steps done`}
          className="h-2 flex-1 overflow-hidden rounded-full bg-background"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{
              width: `${(progress.completed / progress.steps.length) * 100}%`,
            }}
          />
        </div>
        <span
          className="text-sm font-medium tabular-nums"
          data-testid="journey-count"
        >
          {progress.completed} of {progress.steps.length} done
        </span>
      </div>
      <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {progress.steps.map((step, i) => (
          <li key={step.key}>
            <button
              type="button"
              onClick={() => go(step)}
              className="flex w-full items-center gap-3 rounded-lg border bg-card px-3 py-2 text-left text-sm hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {step.done ? (
                <CheckCircle2Icon
                  className="size-5 shrink-0 text-primary"
                  aria-hidden="true"
                />
              ) : (
                <CircleIcon
                  className="size-5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              )}
              <span className="min-w-0 flex-1">
                <span className="font-medium">
                  {i + 1}. {step.label}
                </span>
                <span className="block text-xs text-muted-foreground">
                  As {ROLE_LABELS[step.role]} · {step.done ? "Done" : "To do"}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
