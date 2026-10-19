"use client";

import {
  EllipsisVerticalIcon,
  InfoIcon,
  LogOutIcon,
  MenuIcon,
  RotateCcwIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { BrandLink, HOSPITAL_NAME } from "@/components/brand";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/hms/roles";
import { useSandbox } from "@/lib/hms/sandbox-context";
import { cn } from "@/lib/utils";
import { navItemForPath, navItemsFor } from "./nav-config";
import { RoleSwitcher } from "./role-switcher";
import { focusMainHeading, RouteFocus } from "./route-focus";
import { ResetDemoDialog, SignOutDialog } from "./session-actions";

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { role } = useSandbox();
  const pathname = usePathname();
  const current = navItemForPath(pathname);
  return (
    <ul className="space-y-1">
      {navItemsFor(role).map(({ href, label, icon: Icon }) => {
        const active = current?.href === href;
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function RoleNote() {
  const { role } = useSandbox();
  return (
    <div className="rounded-lg border bg-background/60 p-3 text-xs">
      <p className="font-medium">{ROLE_LABELS[role]} view</p>
      <p className="mt-1 text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
      <p className="mt-2 text-muted-foreground">
        Role switching is a UI demonstration only.{" "}
        <Link href="/about" className="underline underline-offset-2">
          Learn more
        </Link>
      </p>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  // When the menu closes because a link was followed, focus goes to the new
  // page's heading (RouteFocus) instead of back to the menu button.
  const navigatedFromMenu = useRef(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

  return (
    <div className="flex min-h-0 flex-1">
      <RouteFocus />
      {/* Desktop sidebar */}
      <aside
        aria-label="Sidebar"
        data-print-hide
        className="hidden w-64 shrink-0 flex-col gap-6 border-r bg-sidebar p-4 text-sidebar-foreground lg:flex"
      >
        <BrandLink href="/app" />
        <nav aria-label="Main">
          <NavList />
        </nav>
        <div className="mt-auto">
          <RoleNote />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          data-print-hide
          className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
        >
          <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
            {/* Mobile menu */}
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Open navigation menu"
                >
                  <MenuIcon aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-72 bg-sidebar p-4"
                onCloseAutoFocus={(event) => {
                  if (!navigatedFromMenu.current) return;
                  // The open sheet traps focus, so RouteFocus may have been
                  // overridden; focus the new page's heading now instead.
                  event.preventDefault();
                  navigatedFromMenu.current = false;
                  focusMainHeading();
                }}
              >
                <SheetHeader className="p-0">
                  <SheetTitle>Navigation</SheetTitle>
                  <SheetDescription className="sr-only">
                    Screens available to the current demo role.
                  </SheetDescription>
                </SheetHeader>
                <nav aria-label="Main">
                  <NavList
                    onNavigate={() => {
                      navigatedFromMenu.current = true;
                      setMenuOpen(false);
                    }}
                  />
                </nav>
                <div className="mt-auto">
                  <RoleNote />
                </div>
              </SheetContent>
            </Sheet>

            <div className="min-w-0 lg:hidden">
              <BrandLink href="/app" compact />
            </div>
            <p className="hidden truncate text-sm text-muted-foreground lg:block">
              {HOSPITAL_NAME}
            </p>

            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <RoleSwitcher />
              <ThemeToggle />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Demo session menu"
                  >
                    <EllipsisVerticalIcon aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Demo session</DropdownMenuLabel>
                  <DropdownMenuItem asChild>
                    <Link href="/about">
                      <InfoIcon aria-hidden="true" />
                      About this demo
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setResetOpen(true)}>
                    <RotateCcwIcon aria-hidden="true" />
                    Reset demo data
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setSignOutOpen(true)}
                  >
                    <LogOutIcon aria-hidden="true" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 outline-none sm:px-6"
        >
          {children}
        </main>
      </div>

      <ResetDemoDialog open={resetOpen} onOpenChange={setResetOpen} />
      <SignOutDialog open={signOutOpen} onOpenChange={setSignOutOpen} />
    </div>
  );
}
