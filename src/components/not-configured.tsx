import { PlugZapIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { missingFirebaseEnv } from "@/lib/firebase/config";

/** Shown instead of the app when the public Firebase config is missing. */
export function NotConfigured() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <div className="rounded-xl border bg-card p-6 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-full bg-muted">
            <PlugZapIcon className="size-5" aria-hidden="true" />
          </span>
          <h1 className="text-xl font-semibold">Firebase is not configured</h1>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          This deployment has no Firebase web config, so the demo cannot start a
          sandbox. Copy <code>.env.example</code> to <code>.env.local</code>,
          fill in the values from your Firebase web app, and restart the server.
          The README explains each step.
        </p>
        {missingFirebaseEnv.length > 0 && (
          <>
            <h2 className="mt-4 text-sm font-medium">Missing variables</h2>
            <ul className="mt-2 space-y-1 font-mono text-xs">
              {missingFirebaseEnv.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </>
        )}
        <div className="mt-6 flex gap-2">
          <Button asChild variant="outline">
            <Link href="/">Back to home</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/about">About this demo</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
