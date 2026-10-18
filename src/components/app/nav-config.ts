import {
  BanknoteIcon,
  CalendarClockIcon,
  ClipboardListIcon,
  FlaskConicalIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  PillIcon,
  UserCogIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { ROLES, type Role } from "@/lib/hms/roles";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: readonly Role[];
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/app", label: "Overview", icon: LayoutDashboardIcon, roles: ROLES },
  {
    href: "/app/patients",
    label: "Patients",
    icon: UsersIcon,
    roles: ["receptionist", "admin"],
  },
  {
    href: "/app/appointments",
    label: "Appointments",
    icon: CalendarClockIcon,
    roles: ["receptionist", "admin"],
  },
  {
    href: "/app/consultations",
    label: "Consultations",
    icon: ClipboardListIcon,
    roles: ["doctor", "admin"],
  },
  {
    href: "/app/lab",
    label: "Lab orders",
    icon: FlaskConicalIcon,
    roles: ["lab", "admin"],
  },
  {
    href: "/app/pharmacy",
    label: "Pharmacy",
    icon: PillIcon,
    roles: ["pharmacist", "admin"],
  },
  {
    href: "/app/billing",
    label: "Billing",
    icon: BanknoteIcon,
    roles: ["cashier", "admin"],
  },
  { href: "/app/staff", label: "Staff", icon: UserCogIcon, roles: ["admin"] },
  {
    href: "/app/audit-log",
    label: "Audit log",
    icon: HistoryIcon,
    roles: ["admin"],
  },
];

export function navItemsFor(role: Role) {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

/** The nav item that owns a path (longest matching prefix). */
export function navItemForPath(pathname: string): NavItem | undefined {
  return [...NAV_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    );
}

export function isPathAllowed(pathname: string, role: Role) {
  const item = navItemForPath(pathname);
  return !item || item.roles.includes(role);
}

/** Where to land after switching to a role: its first own screen. */
export function homeFor(role: Role) {
  return navItemsFor(role)[1]?.href ?? "/app";
}
