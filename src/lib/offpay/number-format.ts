const subscriptDigits: Record<string, string> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeSignedZero(value: number): number {
  return Object.is(value, -0) || Math.abs(value) < Number.EPSILON * 10 ? 0 : value;
}

function signPrefix(value: number, alwaysSign = false): string {
  const normalized = normalizeSignedZero(value);
  if (normalized < 0) return "-";
  if (alwaysSign && normalized > 0) return "+";
  return "";
}

function compactSuffix(value: number): { divisor: number; suffix: string } | null {
  if (value >= 1_000_000_000_000) return { divisor: 1_000_000_000_000, suffix: "T" };
  if (value >= 1_000_000_000) return { divisor: 1_000_000_000, suffix: "B" };
  if (value >= 1_000_000) return { divisor: 1_000_000, suffix: "M" };
  if (value >= 1_000) return { divisor: 1_000, suffix: "K" };
  return null;
}

function formatCore(value: number, maximumFractionDigits: number, minimumFractionDigits = 0) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
    minimumFractionDigits,
  }).format(normalizeSignedZero(value));
}

function countLeadingZeros(abs: number): number {
  if (abs >= 1) return 0;
  const afterDot = abs.toFixed(20).split(".")[1] ?? "";
  let count = 0;

  for (const digit of afterDot) {
    if (digit !== "0") break;
    count += 1;
  }

  return count;
}

function formatSubscript(value: number, significantDigits: number): string {
  const abs = Math.abs(value);
  const leadingZeros = countLeadingZeros(abs);
  const decimals = leadingZeros + significantDigits;
  const fixed = abs.toFixed(decimals);
  const significant = (fixed.split(".")[1] ?? "").slice(
    leadingZeros,
    leadingZeros + significantDigits,
  );
  const subscript = String(leadingZeros)
    .split("")
    .map((digit) => subscriptDigits[digit] ?? digit)
    .join("");

  return `${signPrefix(value)}0.0${subscript}${significant}`;
}

export function formatFiatValue(
  value: number | null | undefined,
  options: { compact?: boolean; signed?: boolean } = {},
): string {
  if (!isFiniteNumber(value)) return "--";
  const normalized = normalizeSignedZero(value);
  const abs = Math.abs(normalized);
  const sign = signPrefix(normalized, options.signed);

  if (abs === 0) return "$0.00";
  if (abs < 0.01) return `${sign}<$0.01`;

  if (options.compact) {
    const suffix = compactSuffix(abs);
    if (suffix) {
      return `${sign}$${formatCore(abs / suffix.divisor, 1).replace(/\.0$/, "")}${suffix.suffix}`;
    }
  }

  return `${sign}$${formatCore(abs, 2, 2)}`;
}

export function formatPercentValue(value: number | null | undefined, signed = false): string {
  if (!isFiniteNumber(value)) return "--";
  const normalized = normalizeSignedZero(value);
  const abs = Math.abs(normalized);
  const sign = signPrefix(normalized, signed);

  if (abs === 0) return "0.00%";
  if (abs < 0.01) return `${sign}<0.01%`;
  if (abs >= 1000) return `${sign}${formatCore(abs, 0)}%`;
  if (abs >= 100) return `${sign}${formatCore(abs, 1, 1)}%`;

  return `${sign}${formatCore(abs, 2, 2)}%`;
}

export function formatTokenPrice(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) return "--";
  const normalized = normalizeSignedZero(value);
  const abs = Math.abs(normalized);

  if (abs === 0) return "$0.00";
  if (abs < 0.01 && countLeadingZeros(abs) >= 3) {
    return `$${formatSubscript(normalized, 2)}`;
  }
  if (abs < 0.01) return `$${formatCore(normalized, 8)}`;
  if (abs < 1) return `$${formatCore(normalized, 6)}`;
  if (abs < 100) return `$${formatCore(normalized, 2)}`;

  return `$${formatCore(normalized, 2, 2)}`;
}

export function formatTokenAmountDisplay(
  value: number | null | undefined,
  tokenPriceUsd?: number | null,
): string {
  if (!isFiniteNumber(value)) return "--";
  const normalized = normalizeSignedZero(value);
  const abs = Math.abs(normalized);

  if (abs === 0) return "0";
  if (abs < 0.001) return formatSubscript(normalized, 2);

  const price = isFiniteNumber(tokenPriceUsd) && tokenPriceUsd > 0 ? tokenPriceUsd : null;
  const decimals =
    price == null
      ? 4
      : Math.min(6, Math.max(0, Math.ceil(-Math.log10(0.01 / price))));

  return formatCore(normalized, decimals);
}
