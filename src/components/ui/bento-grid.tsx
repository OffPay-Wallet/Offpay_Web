import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Responsive bento-style grid container. Columns and item alignment are
 * controlled by the caller via `className` (e.g. `xl:grid-cols-3`,
 * `items-start`) so the same primitive works for balanced or asymmetric rows.
 */
export function BentoGrid({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-5", className)}>{children}</div>
  );
}

/**
 * A single cell in a BentoGrid. `min-w-0` keeps long content (addresses,
 * numbers) from forcing the grid track wider and causing overflow, and the
 * cell owns its column span so cards stay presentational.
 */
export function BentoItem({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("min-w-0", className)}>{children}</div>;
}
