"use client";

import { LockKeyholeOpenIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/hms/roles";
import { useSandbox } from "@/lib/hms/sandbox-context";
import { navItemForPath } from "./nav-config";

/**
 * Shows the screen only for the roles that use it. This is part of the role
 * demonstration, not a security boundary.
 */
export function RoleGate({ children }: { children: React.ReactNode }) {
  const { role, setRole } = useSandbox();
  const pathname = usePathname();
  const item = navItemForPath(pathname);
  if (!item || item.roles.includes(role)) return <>{children}</>;

  return (
    <div className="mx-auto max-w-lg py-10">
      <div className="rounded-xl border bg-card p-6 text-center">
        <LockKeyholeOpenIcon
          className="mx-auto size-8 text-muted-foreground"
          aria-hidden="true"
        />
        <h1 className="mt-3 text-lg font-semibold">
          This screen is for{" "}
          {item.roles.map((r) => ROLE_LABELS[r]).join(" and ")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {item.label} is not part of the {ROLE_LABELS[role]} view. Role
          switching only changes what the interface shows; it is a UI
          demonstration, not real authorisation.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {item.roles.map((r) => (
            <Button key={r} variant="outline" onClick={() => setRole(r)}>
              Switch to {ROLE_LABELS[r]}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
