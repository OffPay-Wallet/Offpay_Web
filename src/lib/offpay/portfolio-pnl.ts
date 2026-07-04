import type {
  MarketHistoricalUsdPricePoint,
} from "@/lib/offpay/types";
import type {
  PortfolioHolding,
  PortfolioValueChange,
} from "@/lib/offpay/portfolio-valuation";

const usdStablePriceSymbols = new Set(["USDC", "USDT", "DUSDC", "DUSDT"]);

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function normalizeSignedZero(value: number): number {
  return Object.is(value, -0) || Math.abs(value) < Number.EPSILON * 10 ? 0 : value;
}

function normalizePriceSymbol(value: string): string {
  const symbol = value.trim().toUpperCase();
  if (symbol === "WSOL") return "SOL";
  if (symbol === "DUSDC") return "USDC";
  if (symbol === "DUSDT") return "USDT";
  return symbol;
}

function isUsdStablePriceSymbol(value: string): boolean {
  return usdStablePriceSymbols.has(value.trim().toUpperCase());
}

function holdingCurrentUsdPrice(
  holding: PortfolioHolding,
  unitUsdPrices: Readonly<Record<string, number>>,
): number | null {
  const priceSymbol = normalizePriceSymbol(holding.priceSymbol || holding.symbol);
  if (isUsdStablePriceSymbol(priceSymbol)) return 1;

  const price = unitUsdPrices[holding.priceMint];
  return isPositiveNumber(price) ? price : null;
}

function holdingBaselineUsdPrice(
  holding: PortfolioHolding,
  historiesByMint: ReadonlyMap<string, readonly MarketHistoricalUsdPricePoint[]>,
): number | null {
  const priceSymbol = normalizePriceSymbol(holding.priceSymbol || holding.symbol);
  if (isUsdStablePriceSymbol(priceSymbol)) return 1;

  const firstSample = historiesByMint.get(holding.priceMint)?.[0];
  return isPositiveNumber(firstSample?.value) ? firstSample.value : null;
}

export function calculateHoldingValueChanges({
  historiesByMint,
  holdings,
  unitUsdPrices,
}: {
  historiesByMint: ReadonlyMap<string, readonly MarketHistoricalUsdPricePoint[]>;
  holdings: readonly PortfolioHolding[];
  unitUsdPrices: Readonly<Record<string, number>>;
}): Readonly<Record<string, PortfolioValueChange>> {
  const changes: Record<string, PortfolioValueChange> = {};

  for (const holding of holdings) {
    if (!isPositiveNumber(holding.balance)) continue;

    const currentUsdPrice = holdingCurrentUsdPrice(holding, unitUsdPrices);
    const baselineUsdPrice = holdingBaselineUsdPrice(holding, historiesByMint);
    if (!isPositiveNumber(currentUsdPrice) || !isPositiveNumber(baselineUsdPrice)) {
      continue;
    }

    const baselineUsd = holding.balance * baselineUsdPrice;
    if (!isPositiveNumber(baselineUsd)) continue;

    const currentUsd = holding.balance * currentUsdPrice;
    const absoluteUsd = normalizeSignedZero(currentUsd - baselineUsd);
    const percent = normalizeSignedZero((absoluteUsd / baselineUsd) * 100);

    changes[holding.mint] = {
      absoluteUsd,
      percent,
      tone: percent > 0 ? "positive" : percent < 0 ? "negative" : "neutral",
    };
  }

  return changes;
}
