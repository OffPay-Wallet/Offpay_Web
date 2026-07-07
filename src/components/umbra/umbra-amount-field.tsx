"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, Search } from "lucide-react";

import type { UmbraVaultHolding, WalletTokenMetadata } from "@/lib/offpay/types";
import { cn } from "@/lib/utils";

const passthroughImageLoader = ({ src }: { src: string }) => src;

function safeHttpsUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function TokenGlyph({
  className,
  logo,
  symbol,
}: {
  className?: string;
  logo: string | null | undefined;
  symbol: string;
}) {
  const [failed, setFailed] = useState(false);
  const url = failed ? null : safeHttpsUrl(logo);

  return (
    <span
      className={cn(
        "relative flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full",
        "bg-secondary/70 font-mono text-[10px] font-bold uppercase text-secondary-foreground",
        className,
      )}
    >
      {symbol.slice(0, 2)}
      {url ? (
        <Image
          src={url}
          alt=""
          width={24}
          height={24}
          className="absolute inset-0 h-full w-full object-cover"
          loader={passthroughImageLoader}
          unoptimized
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : null}
    </span>
  );
}

type QuickFill = { fraction: number; label: string };

const quickFills: QuickFill[] = [
  { fraction: 0.25, label: "25%" },
  { fraction: 0.5, label: "50%" },
  { fraction: 1, label: "Max" },
];

export function UmbraAmountField({
  amount,
  availableEnabled,
  availableLabel,
  disabled,
  hasError,
  holdings,
  label,
  logoByMint,
  onAmountChange,
  onQuickFill,
  onSelectHolding,
  selectedHolding,
}: {
  amount: string;
  availableEnabled: boolean;
  availableLabel: string | null;
  disabled: boolean;
  hasError: boolean;
  holdings: UmbraVaultHolding[];
  label: string;
  logoByMint: Record<string, WalletTokenMetadata>;
  onAmountChange: (value: string) => void;
  onQuickFill: (fraction: number) => void;
  onSelectHolding: (mint: string) => void;
  selectedHolding: UmbraVaultHolding | null;
}) {
  const symbol = selectedHolding?.symbol ?? "";

  return (
    <div
      className={cn(
        "rounded-2xl p-4 transition-colors duration-200 ease-out",
        hasError ? "bg-destructive/10" : "bg-white/[0.04] focus-within:bg-white/[0.07]",
        disabled && "opacity-60",
      )}
    >
      <span className="block text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
        {label}
      </span>

      <div className="mt-2 flex items-center justify-between gap-3">
        <input
          className={cn(
            "min-w-0 flex-1 bg-transparent font-mono text-3xl font-semibold leading-none tabular-nums",
            "text-foreground outline-none placeholder:text-muted-foreground/40",
          )}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          placeholder="0"
          value={amount}
          disabled={disabled}
          aria-invalid={hasError ? "true" : undefined}
          aria-describedby={hasError ? "umbra-vault-amount-error" : undefined}
          aria-label="Amount"
          onChange={(event) => onAmountChange(event.target.value)}
        />
        <TokenSelect
          disabled={disabled || holdings.length === 0}
          holdings={holdings}
          logoByMint={logoByMint}
          onSelect={onSelectHolding}
          selectedHolding={selectedHolding}
        />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {quickFills.map((quick) => (
            <button
              key={quick.label}
              type="button"
              disabled={disabled || !availableEnabled}
              onClick={() => onQuickFill(quick.fraction)}
              className={cn(
                "rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-semibold",
                "text-muted-foreground transition-colors duration-150",
                "hover:bg-white/[0.12] hover:text-foreground",
                "active:scale-[0.96] motion-reduce:active:scale-100",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:pointer-events-none disabled:opacity-40",
                quick.fraction === 1 && "text-foreground",
              )}
            >
              {quick.label}
            </button>
          ))}
        </div>
        <p className="truncate text-right text-xs text-muted-foreground">
          {availableLabel ? (
            <>
              <span className="text-muted-foreground/70">Balance </span>
              <span className="font-mono tabular-nums text-foreground/90">{availableLabel}</span>
              {symbol ? <span className="text-muted-foreground/70"> {symbol}</span> : null}
            </>
          ) : (
            <span className="text-muted-foreground/60">Balance unavailable</span>
          )}
        </p>
      </div>
    </div>
  );
}

function TokenSelect({
  disabled,
  holdings,
  logoByMint,
  onSelect,
  selectedHolding,
}: {
  disabled: boolean;
  holdings: UmbraVaultHolding[];
  logoByMint: Record<string, WalletTokenMetadata>;
  onSelect: (mint: string) => void;
  selectedHolding: UmbraVaultHolding | null;
}) {
  const [open, setOpen] = useState(false);
  const single = holdings.length <= 1;

  const symbol = selectedHolding?.symbol ?? "Token";
  const logo = selectedHolding ? logoByMint[selectedHolding.mint]?.logo ?? null : null;

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup={single ? undefined : "dialog"}
        aria-expanded={single ? undefined : open}
        onClick={() => {
          if (!single) setOpen(true);
        }}
        className={cn(
          "flex items-center gap-2 rounded-full bg-white/[0.08] py-1.5 pl-1.5 pr-3",
          "text-sm font-semibold text-foreground transition-colors duration-150",
          !single && "hover:bg-white/[0.14]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:pointer-events-none disabled:opacity-50",
          single && "cursor-default",
        )}
      >
        <TokenGlyph logo={logo} symbol={symbol} />
        {symbol}
        {single ? null : (
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ease-out",
              "motion-reduce:transition-none",
              open && "rotate-180",
            )}
            aria-hidden="true"
          />
        )}
      </button>

      <TokenDrawer
        holdings={holdings}
        logoByMint={logoByMint}
        onClose={() => setOpen(false)}
        onSelect={(mint) => {
          onSelect(mint);
          setOpen(false);
        }}
        open={open && !single}
        selectedMint={selectedHolding?.mint ?? null}
      />
    </>
  );
}

const DRAWER_TRANSITION_MS = 300;

/**
 * Token picker rendered as a portal drawer so it can never be clipped by the
 * amount card and always sits on a solid surface. It mounts immediately, then
 * animates in on the next frame, and plays its exit transition before
 * unmounting — so open/close feel like a drawer rather than an instant toggle.
 */
function TokenDrawer({
  holdings,
  logoByMint,
  onClose,
  onSelect,
  open,
  selectedMint,
}: {
  holdings: UmbraVaultHolding[];
  logoByMint: Record<string, WalletTokenMetadata>;
  onClose: () => void;
  onSelect: (mint: string) => void;
  open: boolean;
  selectedMint: string | null;
}) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState("");
  // The shade follows the hovered row; when nothing is hovered it falls back to
  // the selected token. The tick stays on the selected token until a click.
  const [hoveredMint, setHoveredMint] = useState<string | null>(null);

  // Mount synchronously on open (during render, not in an effect) so the enter
  // transition can play from the first painted frame.
  if (open && !mounted) setMounted(true);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredHoldings = normalizedQuery
    ? holdings.filter(
        (holding) =>
          holding.symbol.toLowerCase().includes(normalizedQuery) ||
          holding.name?.toLowerCase().includes(normalizedQuery) ||
          holding.mint.toLowerCase().includes(normalizedQuery),
      )
    : holdings;

  // Enter: flip to visible on the frame after mount so the transition animates.
  useEffect(() => {
    if (!mounted) return;
    const frame = window.requestAnimationFrame(() => setVisible(true));
    return () => window.cancelAnimationFrame(frame);
  }, [mounted]);

  // Exit: play the close transition, then unmount once it finishes.
  useEffect(() => {
    if (open || !mounted) return;
    const frame = window.requestAnimationFrame(() => setVisible(false));
    const timeout = window.setTimeout(() => {
      setMounted(false);
      setQuery("");
      setHoveredMint(null);
    }, DRAWER_TRANSITION_MS);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [open, mounted]);

  useEffect(() => {
    if (!mounted) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted, onClose]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Select token"
    >
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-out",
          "motion-reduce:transition-none",
          visible ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        className={cn(
          "relative z-[1] w-full max-w-md border border-border bg-popover p-2 text-popover-foreground",
          "rounded-t-3xl shadow-[0_-24px_60px_-24px_rgba(0,0,0,0.85)] sm:rounded-3xl sm:shadow-[0_40px_90px_-30px_rgba(0,0,0,0.85)]",
          "transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          visible ? "translate-y-0 opacity-100" : "translate-y-full opacity-100 sm:translate-y-3 sm:opacity-0",
        )}
      >
        <div className="mx-auto mb-3 mt-1 h-1.5 w-10 rounded-full bg-border sm:hidden" aria-hidden="true" />
        <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Select token
        </p>

        <div className="relative mb-2 px-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            autoFocus
            type="text"
            inputMode="search"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search ticker or address"
            aria-label="Search tokens by ticker or address"
            className={cn(
              "w-full rounded-xl bg-white/[0.05] py-2.5 pl-10 pr-3 text-sm text-foreground",
              "outline-none transition-colors placeholder:text-muted-foreground/70",
              "focus:bg-white/[0.08]",
            )}
          />
        </div>

        <ul
          role="listbox"
          aria-label="Select token"
          className="max-h-[52vh] overflow-y-auto pb-1"
          onMouseLeave={() => setHoveredMint(null)}
        >
          {filteredHoldings.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              No tokens match &ldquo;{query.trim()}&rdquo;.
            </li>
          ) : null}
          {filteredHoldings.map((holding) => {
            const selected = holding.mint === selectedMint;
            const shaded = hoveredMint ? holding.mint === hoveredMint : selected;

            return (
              <li key={holding.mint}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => onSelect(holding.mint)}
                  onMouseEnter={() => setHoveredMint(holding.mint)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors duration-150",
                    shaded ? "bg-white/[0.06]" : "bg-transparent",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  <TokenGlyph
                    className="h-8 w-8 text-xs"
                    logo={logoByMint[holding.mint]?.logo ?? null}
                    symbol={holding.symbol}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {holding.symbol}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {holding.name || "Token"}
                    </span>
                  </span>
                  {selected ? (
                    <Check className="h-4 w-4 shrink-0 text-foreground" aria-hidden="true" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
