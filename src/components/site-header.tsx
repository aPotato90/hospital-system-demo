import Link from "next/link";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { BrandLink } from "./brand";

/** Header for the public pages (landing and about). */
export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <BrandLink />
        <nav aria-label="Site" className="flex items-center gap-1">
          <Link
            href="/about"
            className="rounded-md px-3 py-1.5 text-sm font-medium hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            About
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
