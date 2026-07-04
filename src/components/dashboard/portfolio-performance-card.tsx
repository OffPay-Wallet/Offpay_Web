"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";
import { useCallback, useEffect, useId, useMemo, useState } from "react";

import {
  defaultPortfolioTimeframe,
  PortfolioChangePill,
  PortfolioRefreshButton,
  portfolioTimeframes,
  PortfolioTimeframeToggle,
  PortfolioTooltip,
  type PortfolioTimeframeId,
} from "@/components/dashboard/portfolio-performance-ui";
import {
  readGatewayTokenPriceHistory,
  readGatewayTokenPricesBatch,
} from "@/lib/offpay/gateway-client";
import {
  buildMarketHistoryIdentifier,
  buildPortfolioHistorySamples,
  buildPortfolioHoldings,
  buildPortfolioPriceTokens,
  buildPortfolioValuation,
  calculatePortfolioValueChange,
  selectPortfolioHistoryInputs,
  type PortfolioChangeSample,
  type PortfolioHolding,
  type PortfolioValuation,
  type PortfolioValueChange,
} from "@/lib/offpay/portfolio-valuation";
import { formatFiatValue } from "@/lib/offpay/number-format";
import { calculateHoldingValueChanges } from "@/lib/offpay/portfolio-pnl";
import type {
  MarketHistoricalUsdPricePoint,
  SolanaCluster,
  WalletPortfolio,
} from "@/lib/offpay/types";

const emptyUnitUsdPrices: Readonly<Record<string, number>> = Object.freeze({});

export type PortfolioPricingState = {
  change: PortfolioValueChange | null;
  holdingValueChanges: Readonly<Record<string, PortfolioValueChange>>;
  holdings: PortfolioHolding[];
  loading: boolean;
  priceError: Error | null;
  refetchPricing: () => void;
  samples: PortfolioChangeSample[];
  timeframeLabel: string;
  valuation: PortfolioValuation;
};

export function PortfolioPerformanceCard({
  cluster,
  gatewayOrigin,
  isBalancesFetching,
  isBalancesLoading,
  onRefreshBalances,
  onPricingState,
  portfolio,
  walletAddress,
}: {
  cluster: SolanaCluster;
  gatewayOrigin: string | undefined;
  isBalancesFetching: boolean;
  isBalancesLoading: boolean;
  onRefreshBalances: () => void;
  onPricingState?: (state: PortfolioPricingState) => void;
  portfolio: WalletPortfolio | undefined;
  walletAddress: string | undefined;
}) {
  const gradientId = useId().replace(/:/g, "");
  const [timeframeId, setTimeframeId] = useState<PortfolioTimeframeId>("D");
  const activeTimeframe =
    portfolioTimeframes.find((timeframe) => timeframe.id === timeframeId) ??
    defaultPortfolioTimeframe;
  const timeframeDurationMs = activeTimeframe.durationMs;
  const timeframeInterval = activeTimeframe.interval;

  const holdings = useMemo(() => buildPortfolioHoldings(portfolio), [portfolio]);
  const priceTokens = useMemo(() => buildPortfolioPriceTokens(holdings), [holdings]);
  const priceTokenKey = useMemo(
    () =>
      priceTokens
        .map((token) => `${token.mint}:${token.symbol}:${token.priceSymbol}`)
        .join("|"),
    [priceTokens],
  );

  const pricesQuery = useQuery({
    queryKey: ["portfolio-token-prices", gatewayOrigin, cluster, priceTokenKey],
    enabled: Boolean(gatewayOrigin && priceTokens.length > 0),
    queryFn: async () => {
      if (!gatewayOrigin) {
        throw new Error("Gateway origin is not configured.");
      }

      const envelope = await readGatewayTokenPricesBatch(gatewayOrigin, {
        currency: "USD",
        network: cluster,
        tokens: priceTokens,
      });

      if (!envelope.ok) {
        throw new Error(envelope.error.message);
      }

      return envelope.data;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    retry: 1,
  });

  const unitUsdPrices = useMemo(
    () => pricesQuery.data?.unitUsdPrices ?? emptyUnitUsdPrices,
    [pricesQuery.data?.unitUsdPrices],
  );
  const valuation = useMemo(
    () => buildPortfolioValuation({ holdings, unitUsdPrices }),
    [holdings, unitUsdPrices],
  );
  const historySelection = useMemo(
    () => selectPortfolioHistoryInputs({ holdings, currentUnitUsdPrices: unitUsdPrices }),
    [holdings, unitUsdPrices],
  );
  const historyTokenKey = useMemo(
    () =>
      historySelection.historyInputs
        .map((input) => `${input.priceMint}:${input.priceSymbol}:${input.balance}`)
        .join("|"),
    [historySelection.historyInputs],
  );

  const historyQuery = useQuery({
    queryKey: [
      "portfolio-value-history",
      gatewayOrigin,
      cluster,
      timeframeId,
      historyTokenKey,
    ],
    enabled: Boolean(gatewayOrigin && historySelection.historyInputs.length > 0),
    queryFn: async () => {
      if (!gatewayOrigin) {
        throw new Error("Gateway origin is not configured.");
      }

      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - timeframeDurationMs);
      const entries = await Promise.all(
        historySelection.historyInputs.map(async (input) => {
          const envelope = await readGatewayTokenPriceHistory(gatewayOrigin, {
            identifier: buildMarketHistoryIdentifier({ cluster, input }),
            network: cluster,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            interval: timeframeInterval,
            withMarketData: false,
          });

          if (!envelope.ok) {
            return [input.priceMint, [] as MarketHistoricalUsdPricePoint[]] as const;
          }

          return [input.priceMint, envelope.data.prices] as const;
        }),
      );

      return new Map<string, MarketHistoricalUsdPricePoint[]>(entries);
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchIntervalInBackground: false,
    retry: 1,
  });

  const valuationTimestamp = pricesQuery.data?.fetchedAt ?? historyQuery.dataUpdatedAt;
  const samples = useMemo(() => {
    const liveUsdPricesByMint = new Map<string, number>();
    for (const [mint, price] of Object.entries(unitUsdPrices)) {
      if (Number.isFinite(price) && price > 0) {
        liveUsdPricesByMint.set(mint, price);
      }
    }

    return buildPortfolioHistorySamples({
      inputs: historySelection.inputs,
      historiesByMint: historyQuery.data ?? new Map(),
      timestamp: valuationTimestamp,
      durationMs: timeframeDurationMs,
      liveUsdPricesByMint,
    });
  }, [
    historyQuery.data,
    historySelection.inputs,
    timeframeDurationMs,
    unitUsdPrices,
    valuationTimestamp,
  ]);
  const change = useMemo(() => calculatePortfolioValueChange(samples), [samples]);
  const holdingValueChanges = useMemo(
    () =>
      calculateHoldingValueChanges({
        historiesByMint: historyQuery.data ?? new Map(),
        holdings,
        unitUsdPrices,
      }),
    [historyQuery.data, holdings, unitUsdPrices],
  );
  const loading =
    Boolean(walletAddress && isBalancesLoading) ||
    (holdings.length > 0 && pricesQuery.isLoading);
  const priceError =
    pricesQuery.error instanceof Error
      ? pricesQuery.error
      : historyQuery.error instanceof Error
        ? historyQuery.error
        : null;
  const refetchPrices = pricesQuery.refetch;
  const refetchHistory = historyQuery.refetch;
  const refetchPricing = useCallback(() => {
    void refetchPrices();
    void refetchHistory();
  }, [refetchHistory, refetchPrices]);

  useEffect(() => {
    onPricingState?.({
      change,
      holdingValueChanges,
      holdings,
      loading,
      priceError,
      refetchPricing,
      samples,
      timeframeLabel: activeTimeframe.changeLabel,
      valuation,
    });
  }, [
    activeTimeframe.changeLabel,
    change,
    holdingValueChanges,
    holdings,
    loading,
    onPricingState,
    priceError,
    refetchPricing,
    samples,
    valuation,
  ]);

  const canRefresh = Boolean(walletAddress && gatewayOrigin);
  const isRefreshing = isBalancesFetching || pricesQuery.isFetching || historyQuery.isFetching;
  const chartTone = change?.tone ?? "neutral";
  const chartColor =
    chartTone === "negative"
      ? "var(--offpay-color-red)"
      : "var(--offpay-color-seasalt)";
  const hasChart = !loading && samples.length >= 2;
  const baselineUsd = samples[0]?.usdValue ?? null;
  const chartDomain = useMemo<[number, number] | undefined>(() => {
    if (samples.length < 2) return undefined;

    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const sample of samples) {
      if (sample.usdValue < min) min = sample.usdValue;
      if (sample.usdValue > max) max = sample.usdValue;
    }

    const span = max - min;
    const pad = span > 0 ? span * 0.16 : Math.abs(max) * 0.04 || 1;
    return [min - pad, max + pad * 0.6];
  }, [samples]);

  return (
    <section className="relative flex flex-col overflow-hidden rounded-[28px] border border-border/60 bg-card/80 text-card-foreground shadow-[0_28px_80px_rgba(0,0,0,0.32)] backdrop-blur-sm">
      <div className="flex flex-col gap-4 p-6 pb-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Portfolio
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="font-display text-5xl font-bold leading-none tracking-tight tabular-nums md:text-6xl">
              {loading ? "--" : formatFiatValue(valuation.totalUsd)}
            </p>
            <PortfolioChangePill change={change} timeframeLabel={activeTimeframe.changeLabel} />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-start">
          <PortfolioTimeframeToggle activeId={timeframeId} onSelect={setTimeframeId} />
          <PortfolioRefreshButton
            disabled={!canRefresh || isRefreshing}
            isRefreshing={isRefreshing}
            onClick={() => {
              onRefreshBalances();
              void pricesQuery.refetch();
              void historyQuery.refetch();
            }}
          />
        </div>
      </div>

      <div className="relative h-40 w-full">
        {loading ? (
          <div className="mx-6 mb-2 h-[calc(100%-0.5rem)] animate-pulse rounded-2xl bg-secondary/30" />
        ) : hasChart ? (
          <div
            className="h-full w-full"
            style={{
              filter: `drop-shadow(0 8px 16px color-mix(in srgb, ${chartColor} 32%, transparent))`,
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={samples}
                margin={{ top: 16, right: 0, bottom: 0, left: 0 }}
                accessibilityLayer
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={chartColor} stopOpacity={0.42} />
                    <stop offset="55%" stopColor={chartColor} stopOpacity={0.12} />
                    <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  horizontal
                  vertical={false}
                  strokeDasharray="4 8"
                  stroke="var(--offpay-color-silver)"
                  strokeOpacity={0.14}
                />
                <YAxis dataKey="usdValue" hide domain={chartDomain ?? ["dataMin", "dataMax"]} />
                <Tooltip
                  isAnimationActive={false}
                  allowEscapeViewBox={{ x: false, y: false }}
                  offset={12}
                  cursor={{
                    stroke: chartColor,
                    strokeOpacity: 0.35,
                    strokeDasharray: "4 4",
                  }}
                  content={
                    <PortfolioTooltip baselineUsd={baselineUsd} tone={chartTone} />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="usdValue"
                  stroke={chartColor}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill={`url(#${gradientId})`}
                  dot={false}
                  activeDot={{
                    r: 5,
                    fill: chartColor,
                    stroke: "var(--offpay-color-night)",
                    strokeWidth: 3,
                  }}
                  isAnimationActive={false}
                  connectNulls
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="mx-6 mb-2 flex h-[calc(100%-0.5rem)] items-center justify-center rounded-2xl border border-border/60 bg-background/40 p-4 text-center">
            <p className="text-sm text-muted-foreground">
              {priceError
                ? priceError.message
                : holdings.length === 0
                  ? "No priced holdings found in this wallet yet."
                  : "Chart history is unavailable for these holdings."}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
