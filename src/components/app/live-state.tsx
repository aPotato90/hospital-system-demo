"use client";

import { AlertCircleIcon, Loader2Icon, RotateCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** Centered loading state used while the sandbox opens or seeds. */
export function FullPageLoading({
  title,
  detail,
}: {
  title: string;
  detail?: string;
}) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex flex-1 items-center justify-center px-4 py-24 outline-none"
    >
      <div role="status" aria-live="polite" className="max-w-sm text-center">
        <Loader2Icon
          className="mx-auto size-8 animate-spin text-primary"
          aria-hidden="true"
        />
        <h1 className="mt-4 text-lg font-semibold">{title}…</h1>
        {detail && (
          <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
        )}
      </div>
    </main>
  );
}

/** Error card with a retry button for failed reads. */
export function ErrorState({
  title = "Something went wrong",
  error,
  onRetry,
}: {
  title?: string;
  error: Error;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-destructive/30 bg-destructive/5 p-5"
    >
      <div className="flex items-start gap-3">
        <AlertCircleIcon
          className="mt-0.5 size-5 shrink-0 text-destructive"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{title}</p>
          <p className="mt-1 text-sm break-words text-muted-foreground">
            {friendlyError(error)}
          </p>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={onRetry}
            >
              <RotateCwIcon aria-hidden="true" />
              Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function friendlyError(error: Error) {
  const code = (error as { code?: string }).code;
  if (code === "permission-denied") {
    return "The database refused the request. Check that the Firestore rules from firestore.rules are published.";
  }
  if (code === "unavailable") {
    return "The database could not be reached. Check your connection.";
  }
  return error.message;
}

/** Placeholder rows while a list loads. */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
