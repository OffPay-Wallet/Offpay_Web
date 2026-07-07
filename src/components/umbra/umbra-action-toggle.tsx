"use client";

import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

import type { VaultAction } from "./umbra-vault-validation";

const options = [
  { id: "shield", label: "Shield", hint: "Wallet to private", Icon: ArrowDownLeft },
  { id: "unshield", label: "Unshield", hint: "Private to wallet", Icon: ArrowUpRight },
] as const;

/**
 * Segmented Shield/Unshield control. A single indicator slides between the two
 * segments via a transform (deterministic, GPU-friendly), rather than animating
 * per-segment backgrounds. The motion is tied to selection intent only and is
 * disabled under prefers-reduced-motion.
 */
export function UmbraActionToggle({
  action,
  disabled,
  onChange,
}: {
  action: VaultAction;
  disabled: boolean;
  onChange: (next: VaultAction) => void;
}) {
  const activeIndex = options.findIndex((option) => option.id === action);

  return (
    <div
      role="tablist"
      aria-label="Vault action"
      className={cn(
        "relative grid grid-cols-2 gap-1 rounded-2xl bg-white/[0.04] p-1",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      {/* Sliding active indicator. */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.375rem)] rounded-xl",
          "bg-white/[0.1]",
          "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        )}
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
      />

      {options.map((option) => {
        const selected = option.id === action;
        const Icon = option.Icon;

        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={cn(
              "relative z-[1] flex min-h-10 items-center justify-center gap-2 rounded-xl px-3",
              "text-sm font-semibold transition-colors duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => onChange(option.id)}
          >
            <Icon
              className={cn(
                "h-4 w-4 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                "motion-reduce:transition-none",
                selected ? "scale-100" : "scale-90",
              )}
              aria-hidden="true"
            />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
