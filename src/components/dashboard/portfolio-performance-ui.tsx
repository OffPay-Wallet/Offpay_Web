import { RefreshCw, TrendingDown, TrendingUp, TriangleAlert } from "lucide-react";

import {
  formatFiatValue,
  formatPercentValue,
} from "@/lib/offpay/number-format";
import type { PortfolioValueChange } from "@/lib/offpay/portfolio-valuation";
import { cn } from "@/lib/utils";

const dayMs = 24 * 60 * 60 * 1000;

export type PortfolioTimeframeId = "D" | "W" | "M" | "Y";

export type PortfolioTimeframe = {
  id: PortfolioTimeframeId;
  label: string;
  changeLabel: string;
  durationMs: number;
  interval: "5m" | "1h" | "1d";
};

export const defaultPortfolioTimeframe: PortfolioTimeframe = {
  id: "D",
  label: "D",
  changeLabel: "24H",
  durationMs: dayMs,
  interval: "5m",
};

export const portfolioTimeframes: readonly PortfolioTimeframe[] = [
  defaultPortfolioTimeframe,
  { id: "W", label: "W", changeLabel: "7D", durationMs: 7 * dayMs, interval: "1h" },
  { id: "M", label: "M", changeLabel: "30D", durationMs: 30 * dayMs, interval: "1d" },
  { id: "Y", label: "Y", changeLabel: "1Y", durationMs: 365 * dayMs, interval: "1d" },
];

export function PortfolioTimeframeToggle({
  activeId,
  onSelect,
}: {
  activeId: PortfolioTimeframeId;
  onSelect: (id: PortfolioTimeframeId) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Chart timeframe"
      className="flex items-center gap-0.5 rounded-full border border-border/70 bg-background/50 p-1"
    >
      {portfolioTimeframes.map((timeframe) => {
        const isActive = timeframe.id === activeId;
        return (
          <button
            key={timeframe.id}
            type="button"
            onClick={() => onSelect(timeframe.id)}
            aria-pressed={isActive}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {timeframe.label}
          </button>
        );
      })}
    </div>
  );
}

export function PortfolioChangePill({
  change,
  timeframeLabel,
}: {
  change: PortfolioValueChange | null;
  timeframeLabel: string;
}) {
  if (!change) {
    return (
      <span className="rounded-full bg-secondary/50 px-3 py-1 text-xs font-semibold text-muted-foreground">
        {timeframeLabel} --
      </span>
    );
  }

  const positive = change.tone === "positive";
  const negative = change.tone === "negative";
  const Icon = positive ? TrendingUp : negative ? TrendingDown : TriangleAlert;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset",
        positive && "bg-gain/15 text-gain ring-gain/25",
        negative && "bg-loss/15 text-loss ring-loss/25",
        !positive && !negative && "bg-secondary/50 text-muted-foreground ring-transparent",
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="font-mono tabular-nums">
        {formatFiatValue(change.absoluteUsd, { signed: true, compact: true })}
      </span>
      <span className="font-mono tabular-nums">
        {formatPercentValue(change.percent, true)}
      </span>
    </span>
  );
}

export function PortfolioRefreshButton({
  disabled,
  isRefreshing,
  onClick,
}: {
  disabled: boolean;
  isRefreshing: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/50 text-muted-foreground",
        "transition-colors hover:text-foreground focus-visible:outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-40",
      )}
      title="Refresh portfolio"
      aria-label="Refresh portfolio"
    >
      <RefreshCw
        className={cn("h-4 w-4", isRefreshing && "motion-safe:animate-spin")}
        aria-hidden="true"
      />
    </button>
  );
}

export function PortfolioTooltip({
  active,
  payload,
  baselineUsd,
  tone,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | string | null }>;
  baselineUsd?: number | null;
  tone?: PortfolioValueChange["tone"];
}) {
  if (!active || !payload?.length) return null;

  const rawValue = payload[0]?.value;
  const value = typeof rawValue === "number" ? rawValue : null;
  const delta =
    value != null && typeof baselineUsd === "number" ? value - baselineUsd : null;
  const deltaPositive = delta != null && delta > 0;
  const deltaNegative = delta != null && delta < 0;
  const DeltaIcon = deltaPositive ? TrendingUp : deltaNegative ? TrendingDown : null;

  return (
    <div className="rounded-2xl border border-border bg-popover px-3.5 py-2.5 text-xs text-popover-foreground shadow-[0_12px_34px_rgba(0,0,0,0.5)]">
      <p className="font-mono text-sm font-semibold tabular-nums">
        {value != null ? formatFiatValue(value) : "--"}
      </p>
      {delta != null ? (
        <p
          className={cn(
            "mt-0.5 flex items-center gap-1 font-mono font-semibold tabular-nums",
            deltaPositive && "text-gain",
            deltaNegative && "text-loss",
            !deltaPositive && !deltaNegative && "text-muted-foreground",
            tone === "neutral" && !deltaPositive && !deltaNegative && "text-muted-foreground",
          )}
        >
          {DeltaIcon ? <DeltaIcon className="h-3 w-3" aria-hidden="true" /> : null}
          {formatFiatValue(delta, { signed: true })}
        </p>
      ) : null}
    </div>
  );
}
