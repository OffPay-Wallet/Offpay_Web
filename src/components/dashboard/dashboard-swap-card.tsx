"use client";

import Link from "next/link";
import { ArrowDownUp, ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import {
  formatFiatValue,
  formatTokenAmountDisplay,
  formatTokenPrice,
} from "@/lib/offpay/number-format";
import type { PortfolioHolding } from "@/lib/offpay/portfolio-valuation";
import type { SolanaCluster } from "@/lib/offpay/types";
import { cn } from "@/lib/utils";

const clusterLabels: Record<SolanaCluster, string> = {
  "solana:devnet": "devnet",
  "solana:testnet": "testnet",
  "solana:mainnet": "mainnet",
};

export function DashboardSwapCard({
  cluster,
  holdings,
  priceError,
  unitUsdPrices,
  walletAddress,
}: {
  cluster: SolanaCluster;
  holdings: PortfolioHolding[];
  priceError: Error | null;
  unitUsdPrices: Readonly<Record<string, number>>;
  walletAddress: string | undefined;
}) {
  const swapAvailable = cluster === "solana:mainnet";
  const networkLabel = clusterLabels[cluster];
  const swapHoldings = useMemo(
    () => holdings.filter((holding) => holding.balance > 0),
    [holdings],
  );
  const [selectedMint, setSelectedMint] = useState<string>("");
  const [amount, setAmount] = useState("");
  const effectiveSelectedMint =
    selectedMint && swapHoldings.some((holding) => holding.priceMint === selectedMint)
      ? selectedMint
      : swapHoldings[0]?.priceMint ?? "";

  const selectedHolding =
    swapHoldings.find((holding) => holding.priceMint === effectiveSelectedMint) ??
    swapHoldings[0] ??
    null;
  const amountValue = Number(amount);
  const validAmount = Number.isFinite(amountValue) && amountValue > 0 ? amountValue : 0;
  const selectedPrice = selectedHolding ? unitUsdPrices[selectedHolding.priceMint] : undefined;
  const estimatedUsd =
    selectedHolding && selectedPrice && validAmount > 0 ? validAmount * selectedPrice : null;
  const exceedsBalance = selectedHolding ? validAmount > selectedHolding.balance : false;
  const canOpenSwap =
    swapAvailable && Boolean(selectedHolding && validAmount > 0 && !exceedsBalance);
  const swapHref = selectedHolding
    ? {
        pathname: "/swap",
        query: {
          inputMint: selectedHolding.mint,
          amount,
        },
      }
    : "/swap";

  return (
    <section className="rounded-[28px] border border-border/60 bg-card/80 p-5 text-card-foreground shadow-[0_28px_80px_rgba(0,0,0,0.32)] backdrop-blur-sm md:p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Swap
        </p>
        <h2 className="mt-2 font-display text-3xl font-bold leading-tight tracking-tight">
          Exchange assets
        </h2>
      </div>

      <form className="mt-5 space-y-2.5">
        <div className="rounded-2xl border border-border/50 bg-background/55 p-4">
          <label
            htmlFor="dashboard-swap-amount"
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            You sell
          </label>
          <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-3">
            <input
              id="dashboard-swap-amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              onChange={(event) => {
                const nextValue = event.target.value;
                if (/^\d*(?:\.\d*)?$/.test(nextValue)) {
                  setAmount(nextValue);
                }
              }}
              placeholder="0.00"
              className="min-w-0 bg-transparent font-display text-3xl font-bold tracking-tight tabular-nums text-foreground outline-none placeholder:text-muted-foreground/55 focus-visible:ring-0"
              aria-describedby="dashboard-swap-help"
            />
            <select
              value={selectedHolding?.priceMint ?? ""}
              onChange={(event) => setSelectedMint(event.target.value)}
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Select sell token"
              disabled={swapHoldings.length === 0}
            >
              {swapHoldings.map((holding) => (
                <option key={holding.id} value={holding.priceMint}>
                  {holding.symbol}
                </option>
              ))}
            </select>
          </div>
          <p id="dashboard-swap-help" className="mt-2 text-xs text-muted-foreground">
            {selectedHolding
              ? `Available ${formatTokenAmountDisplay(
                  selectedHolding.balance,
                  selectedPrice,
                )} ${selectedHolding.symbol}`
              : walletAddress
                ? "No swappable public holdings found."
                : "Connect a wallet to prepare a swap."}
          </p>
        </div>

        <div className="flex justify-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <ArrowDownUp className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>

        <div className="rounded-2xl border border-border/50 bg-background/55 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            You get
          </p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <p className="font-display text-3xl font-bold tracking-tight tabular-nums">
              {estimatedUsd == null ? "--" : formatFiatValue(estimatedUsd)}
            </p>
            <span className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold">
              USD
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {selectedHolding && selectedPrice
              ? `${selectedHolding.symbol} live price ${formatTokenPrice(selectedPrice)}`
              : priceError
                ? priceError.message
                : "Waiting for live token pricing."}
          </p>
        </div>

        {exceedsBalance ? (
          <p className="text-xs font-semibold text-destructive">
            Amount exceeds your available balance.
          </p>
        ) : null}

        <div className="pt-2">
          {!swapAvailable ? (
            <>
              <span
                className={cn(
                  buttonVariants({ variant: "secondary" }),
                  "w-full cursor-not-allowed opacity-60",
                )}
                aria-disabled="true"
                title={`Swap is not available on ${networkLabel}`}
              >
                Unavailable on {networkLabel}
              </span>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Swaps are only available on mainnet.
              </p>
            </>
          ) : canOpenSwap ? (
            <Link
              href={swapHref}
              className={cn(buttonVariants({ variant: "primary" }), "w-full")}
            >
              Open swap
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : (
            <span
              className={cn(
                buttonVariants({ variant: "secondary" }),
                "w-full cursor-not-allowed opacity-60",
              )}
              aria-disabled="true"
            >
              Open swap
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
