import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function SectionCard({
  children,
  className,
  icon,
  title,
}: {
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
  title?: string;
}) {
  return (
    <section className={cn("rounded-lg border border-border bg-card p-5 text-card-foreground", className)}>
      {title || icon ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title ? <h2 className="text-base font-semibold">{title}</h2> : <span />}
          {icon ? <div className="text-muted-foreground">{icon}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
