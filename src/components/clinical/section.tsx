import { cn } from "@/lib/utils";

/** Card section with a labelled heading (shared by detail screens). */
export function Section({
  id,
  title,
  children,
  className,
  actions,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn("rounded-xl border bg-card p-5", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="font-semibold">
          {title}
        </h2>
        {actions}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}
