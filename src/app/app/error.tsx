"use client";

import { AlertCircleIcon, RotateCwIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Error boundary for /app screens: the shell stays, the screen can retry. */
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div role="alert" className="mx-auto max-w-lg py-10">
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
        <div className="flex items-start gap-3">
          <AlertCircleIcon
            className="mt-1 size-5 shrink-0 text-destructive"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h1 className="text-lg font-semibold">This screen hit a problem</h1>
            <p className="mt-1 text-sm break-words text-muted-foreground">
              {error.message ||
                "Something went wrong while showing this screen."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => retry()}>
                <RotateCwIcon aria-hidden="true" />
                Try again
              </Button>
              <Button asChild variant="outline">
                <Link href="/app">Back to overview</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
