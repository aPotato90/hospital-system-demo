import { HeartPulseIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const PRODUCT_NAME = "Demo Hospital Manager";
export const HOSPITAL_NAME = "Riverside Demo General Hospital";
export const AUTHOR_NAME = "Emmanuel Kelvin";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground",
        className,
      )}
      aria-hidden="true"
    >
      <HeartPulseIcon className="size-5" />
    </span>
  );
}

export function BrandLink({
  href = "/",
  compact = false,
}: {
  href?: string;
  /** Show only the mark on narrow screens (the name stays for screen readers). */
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-md font-semibold tracking-tight focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <BrandMark />
      <span className={compact ? "sr-only sm:not-sr-only" : undefined}>
        {PRODUCT_NAME}
      </span>
    </Link>
  );
}
