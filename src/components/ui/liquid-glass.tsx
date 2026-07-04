"use client";

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type LiquidGlassProps = HTMLAttributes<HTMLDivElement> & {
  /** Base tint — any CSS color, e.g. a design token var. */
  tint?: string;
  children: ReactNode;
};

/**
 * Reusable Apple-style "liquid glass" surface.
 *
 * Reimagined from how Apple's material reads rather than a gradient wash:
 *  - a single SOLID translucent tint (no gradients),
 *  - a frosted backdrop that blurs + saturates whatever is behind it,
 *  - crisp specular rim highlights (bright top edge, colored rim + depth) via
 *    box-shadows — the light-catching edge is what makes it look like glass,
 *  - a soft colored outer glow for lift.
 *
 * The provided reference button markup is used only as inspiration; none of it
 * is embedded here.
 *
 * @example
 * <LiquidGlass tint="var(--offpay-color-green)" className="rounded-[28px] p-6">
 *   ...content...
 * </LiquidGlass>
 */
export function LiquidGlass({
  children,
  className,
  tint = "var(--offpay-color-seasalt)",
  style,
  ...rest
}: LiquidGlassProps) {
  const surfaceStyle: CSSProperties = {
    ...style,
    // Single solid translucent tint — the status colour reads across the whole
    // surface. No gradients.
    backgroundColor: `color-mix(in srgb, ${tint} 42%, rgba(12, 13, 15, 0.62))`,
    backdropFilter: "blur(28px) saturate(190%)",
    WebkitBackdropFilter: "blur(28px) saturate(190%)",
    // Light-catching rim.
    border: `1px solid color-mix(in srgb, ${tint} 40%, rgba(255, 255, 255, 0.35))`,
    boxShadow: [
      // bright top specular line
      "inset 0 1px 0 0 rgba(255, 255, 255, 0.6)",
      // soft top inner sheen
      "inset 0 10px 26px -16px rgba(255, 255, 255, 0.55)",
      // colored depth toward the bottom
      `inset 0 -30px 64px -34px color-mix(in srgb, ${tint} 75%, transparent)`,
      // colored outer glow / lift
      `0 40px 120px -32px color-mix(in srgb, ${tint} 55%, transparent)`,
    ].join(", "),
  };

  return (
    <div
      className={cn("relative isolate overflow-hidden", className)}
      style={surfaceStyle}
      {...rest}
    >
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
