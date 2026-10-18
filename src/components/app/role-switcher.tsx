"use client";

import { usePathname, useRouter } from "next/navigation";
import { useId } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/hms/roles";
import { useSandbox } from "@/lib/hms/sandbox-context";
import { cn } from "@/lib/utils";
import { homeFor, isPathAllowed } from "./nav-config";

/** Demo role switcher. Changes the navigation; it is not access control. */
export function RoleSwitcher({ className }: { className?: string }) {
  const { role, setRole } = useSandbox();
  const router = useRouter();
  const pathname = usePathname();
  const id = useId();

  async function change(next: Role) {
    if (!isPathAllowed(pathname, next)) router.push(homeFor(next));
    try {
      await setRole(next);
    } catch {
      toast.error("Could not save the role. Try again.");
    }
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <label
        htmlFor={id}
        className="hidden text-xs font-medium whitespace-nowrap text-muted-foreground sm:block"
      >
        Viewing as
      </label>
      <Select value={role} onValueChange={(v) => change(v as Role)}>
        <SelectTrigger
          id={id}
          aria-label="Viewing as (demo role)"
          data-testid="role-switcher"
          className="min-w-36 border-primary/40 bg-accent font-medium text-accent-foreground"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {ROLES.map((r) => (
            <SelectItem key={r} value={r}>
              {ROLE_LABELS[r]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
