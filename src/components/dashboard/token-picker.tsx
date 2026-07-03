"use client";

import Image from "next/image";
import { Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { SwapTokenInfo } from "@/lib/offpay/types";
import { cn } from "@/lib/utils";

const passthroughImageLoader = ({ src }: { src: string }) => src;
const maxRenderedTokens = 80;

function httpsLogo(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function TokenIcon({
  logoURI,
  symbol,
  size = 32,
  className,
}: {
  logoURI: string | null | undefined;
  symbol: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = failed ? null : httpsLogo(logoURI);

  if (!src) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-secondary text-[0.7em] font-semibold uppercase text-secondary-foreground",
          className,
        )}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        {symbol.slice(0, 2)}
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={`${symbol} logo`}
      width={size}
      height={size}
      className={cn("shrink-0 rounded-full object-cover", className)}
      style={{ width: size, height: size }}
      loader={passthroughImageLoader}
      unoptimized
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

export function TokenPicker({
  open,
  onClose,
  onSelect,
  tokens,
  loading,
  error,
  excludeAddress,
  title = "Select a token",
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (token: SwapTokenInfo) => void;
  tokens: SwapTokenInfo[];
  loading: boolean;
  error: string | null;
  excludeAddress?: string;
  title?: string;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset the search on close so the next open starts clean, without
  // synchronously calling setState inside an effect.
  const handleClose = useCallback(() => {
    setQuery("");
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, handleClose]);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const available = excludeAddress
      ? tokens.filter((token) => token.address !== excludeAddress)
      : tokens;

    if (!normalized) {
      return available.slice(0, maxRenderedTokens);
    }

    return available
      .filter(
        (token) =>
          token.symbol.toLowerCase().includes(normalized) ||
          token.name.toLowerCase().includes(normalized) ||
          token.address.toLowerCase() === normalized,
      )
      .slice(0, maxRenderedTokens);
  }, [excludeAddress, query, tokens]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-3xl border border-border/60 bg-card text-card-foreground shadow-[0_28px_80px_rgba(0,0,0,0.45)] sm:max-w-md sm:rounded-3xl">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 p-4">
          <h3 className="text-base font-semibold">{title}</h3>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close token selector"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-4 pb-2">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name or paste address"
              className="h-11 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
              aria-label="Search tokens"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {loading ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Loading tokens…</p>
          ) : error ? (
            <p className="p-6 text-center text-sm text-muted-foreground">{error}</p>
          ) : results.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No tokens match your search.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {results.map((token) => (
                <li key={token.address}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(token);
                      handleClose();
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <TokenIcon logoURI={token.logoURI} symbol={token.symbol} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {token.symbol}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {token.name}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
