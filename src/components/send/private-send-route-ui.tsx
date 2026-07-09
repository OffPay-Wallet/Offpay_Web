import { CheckCircle2, ChevronDown, Info, Route } from "lucide-react";

import { formatFiatValue } from "@/lib/offpay/number-format";
import { formatAtomicTokenAmount, type PrivateSendToken } from "@/lib/offpay/private-send";
import type { PrivateSendFeeQuote } from "@/lib/offpay/private-send-fees";
import type { PrivateSendProvider } from "@/lib/offpay/private-send";
import { cn } from "@/lib/utils";

export type PrivateSendResult = {
  amountLabel: string;
  provider: PrivateSendProvider;
  signatureLabel: string | null;
};

const providerOptions = [
  {
    description: "PER route",
    id: "magicblock",
    label: "MagicBlock",
  },
  {
    description: "Stealth note",
    id: "umbra",
    label: "Umbra",
  },
] satisfies Array<{
  description: string;
  id: PrivateSendProvider;
  label: string;
}>;

function selectedProviderLabel(provider: PrivateSendProvider): string {
  return provider === "magicblock" ? "MagicBlock" : "Umbra";
}

export function PrivateSendAmountCard({
  amount,
  balanceLabel,
  balanceLoading,
  balanceUnavailable,
  canUseMax,
  fiatLabel,
  hasError,
  onAmountChange,
  onMax,
  onMintChange,
  selectedMint,
  selectedToken,
  tokens,
}: {
  amount: string;
  balanceLabel: string | null;
  balanceLoading: boolean;
  balanceUnavailable: boolean;
  canUseMax: boolean;
  fiatLabel: string;
  hasError: boolean;
  onAmountChange: (value: string) => void;
  onMax: () => void;
  onMintChange: (mint: string) => void;
  selectedMint: string;
  selectedToken: PrivateSendToken | null;
  tokens: PrivateSendToken[];
}) {
  const symbol = selectedToken?.symbol ?? "Token";

  return (
    <section
      className={cn(
        "rounded-[1.75rem] border border-border/80 bg-white/[0.03] p-5 transition-colors duration-200",
        "focus-within:bg-white/[0.055]",
        hasError && "border-destructive/40 bg-destructive/10",
      )}
    >
      <label htmlFor="private-send-amount" className="text-sm font-semibold text-primary">
        You&apos;re sending
      </label>

      <div className="mt-4 flex items-center justify-between gap-4">
        <input
          id="private-send-amount"
          value={amount}
          onChange={(event) => onAmountChange(event.target.value)}
          className={cn(
            "min-w-0 flex-1 bg-transparent font-mono text-5xl font-semibold leading-none tabular-nums",
            "text-foreground outline-none placeholder:text-muted-foreground/40",
          )}
          autoComplete="off"
          inputMode="decimal"
          placeholder="0"
          spellCheck={false}
          type="text"
          aria-invalid={hasError ? "true" : undefined}
          aria-describedby={hasError ? "private-send-amount-error" : undefined}
        />
        <TokenSelect
          disabled={tokens.length === 0}
          onChange={onMintChange}
          selectedMint={selectedMint}
          symbol={symbol}
          tokens={tokens}
        />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span className="font-mono tabular-nums">{fiatLabel}</span>
        <span className="flex min-w-0 items-center gap-2 text-right">
          <span className="truncate">
            Balance:{" "}
            {balanceLoading
              ? "Updating"
              : balanceLabel
                ? `${balanceLabel} ${symbol}`
                : balanceUnavailable
                  ? "Unavailable"
                  : `0 ${symbol}`}
          </span>
          <button
            type="button"
            onClick={onMax}
            disabled={!canUseMax || balanceLoading}
            className={cn(
              "min-h-10 rounded-full px-2 text-sm font-semibold text-foreground transition-colors",
              "hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:pointer-events-none disabled:opacity-40",
            )}
          >
            Max
          </button>
        </span>
      </div>
    </section>
  );
}

function TokenSelect({
  disabled,
  onChange,
  selectedMint,
  symbol,
  tokens,
}: {
  disabled: boolean;
  onChange: (mint: string) => void;
  selectedMint: string;
  symbol: string;
  tokens: PrivateSendToken[];
}) {
  return (
    <label className="relative shrink-0">
      <span className="sr-only">Asset</span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-primary/20 font-mono text-xs font-bold text-primary"
      >
        {symbol.slice(0, 2)}
      </span>
      <select
        value={selectedMint}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className={cn(
          "h-12 appearance-none rounded-full bg-white/[0.08] pl-12 pr-9 text-base font-semibold text-foreground",
          "outline-none transition-colors hover:bg-white/[0.14]",
          "focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        )}
      >
        {tokens.map((token) => (
          <option key={token.mint} value={token.mint}>
            {token.symbol}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
    </label>
  );
}

export function PrivateSendRecipientCard({
  error,
  onPaste,
  onRecipientChange,
  recipient,
}: {
  error: string | null;
  onPaste: () => void;
  onRecipientChange: (value: string) => void;
  recipient: string;
}) {
  return (
    <section className="rounded-[1.75rem] border border-border/80 bg-white/[0.03] p-5">
      <label
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground"
        htmlFor="private-send-recipient"
      >
        Receiver&rsquo;s address
        <Info className="h-4 w-4" aria-hidden="true">
          <title>Paste a Solana wallet address that can receive the selected token.</title>
        </Info>
      </label>

      <div className="mt-4 flex min-h-14 items-center gap-2 rounded-2xl border border-border bg-white/[0.04] px-4">
        <input
          id="private-send-recipient"
          value={recipient}
          onChange={(event) => onRecipientChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
          autoComplete="off"
          spellCheck={false}
          placeholder="Enter or select Solana address"
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? "private-send-recipient-error" : undefined}
        />
        <button
          type="button"
          onClick={onPaste}
          className={cn(
            "min-h-10 rounded-xl border border-border bg-white/[0.04] px-4 text-xs font-semibold uppercase tracking-wide",
            "text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          Paste
        </button>
      </div>

      {error ? (
        <p id="private-send-recipient-error" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}

export function PrivateSendRouteSelector({
  onProviderChange,
  provider,
}: {
  onProviderChange: (provider: PrivateSendProvider) => void;
  provider: PrivateSendProvider;
}) {
  const activeIndex = providerOptions.findIndex((option) => option.id === provider);

  return (
    <fieldset className="grid gap-2">
      <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Private route
      </legend>
      <div className="relative grid grid-cols-2 gap-1 rounded-2xl bg-white/[0.04] p-1">
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.375rem)] rounded-xl bg-white/[0.1]",
            "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          )}
          style={{ transform: `translateX(${activeIndex * 100}%)` }}
        />
        {providerOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={provider === option.id}
            onClick={() => onProviderChange(option.id)}
            className={cn(
              "relative z-[1] flex min-h-11 items-center justify-center gap-2 rounded-xl px-3",
              "text-sm font-semibold transition-colors duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              provider === option.id
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Route className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block truncate">{option.label}</span>
              <span className="block truncate text-[0.6875rem] font-medium text-muted-foreground">
                {option.description}
              </span>
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function PrivateSendResultBanner({ result }: { result: PrivateSendResult }) {
  return (
    <div className="rounded-2xl border border-success/30 bg-success/10 p-3 text-sm text-success">
      <span className="flex items-center gap-2 font-medium">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        Sent {result.amountLabel} through {selectedProviderLabel(result.provider)}
      </span>
      {result.signatureLabel ? (
        <span className="mt-1 block font-mono text-xs tabular-nums">
          {result.signatureLabel}
        </span>
      ) : null}
    </div>
  );
}

export function PrivateSendFeeSummary({
  error,
  isLoading,
  quote,
  solPriceUsd,
  token,
  tokenPriceUsd,
}: {
  error: string | null;
  isLoading: boolean;
  quote: PrivateSendFeeQuote | null;
  solPriceUsd: number | null;
  token: PrivateSendToken | null;
  tokenPriceUsd: number | null;
}) {
  if (!token) return null;

  const minReceivedLabel = quote
    ? `${formatAtomicTokenAmount(quote.minReceivedAtomic, token.decimals)} ${token.symbol}`
    : "-";
  const tokenFeeLabel = quote
    ? `${formatAtomicTokenAmount(quote.tokenFeeAtomic, token.decimals)} ${token.symbol}`
    : "-";
  const networkFeeLabel =
    quote?.networkFeeLamports != null
      ? `${formatAtomicTokenAmount(quote.networkFeeLamports, 9)} SOL`
      : "-";
  const networkFeeUsd =
    quote?.networkFeeLamports != null && solPriceUsd
      ? (Number(quote.networkFeeLamports) / 1_000_000_000) * solPriceUsd
      : null;
  const tokenFeeUsd =
    quote && tokenPriceUsd
      ? (Number(quote.tokenFeeAtomic) / 10 ** token.decimals) * tokenPriceUsd
      : null;

  return (
    <div className="divide-y divide-white/[0.06] rounded-2xl bg-white/[0.04] text-sm">
      <FeeRow
        label="Min received"
        title="Amount after provider token fees returned by the selected route."
        value={isLoading ? "Updating" : minReceivedLabel}
      />
      <FeeRow
        label="Provider fee"
        title="Token-side fee calculated by the provider route before signing."
        value={isLoading ? "Updating" : tokenFeeLabel}
        secondary={tokenFeeUsd != null ? formatFiatValue(tokenFeeUsd) : null}
      />
      <FeeRow
        label="Network fee"
        title="SOL fee or reserve returned by the provider or gateway RPC before signing."
        value={isLoading ? "Updating" : networkFeeLabel}
        secondary={networkFeeUsd != null ? formatFiatValue(networkFeeUsd) : null}
      />
      {error ? <p className="px-3 py-2 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function FeeRow({
  label,
  secondary,
  title,
  value,
}: {
  label: string;
  secondary?: string | null;
  title: string;
  value: string;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 px-3">
      <span className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
        {label}
        <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
          <title>{title}</title>
        </Info>
      </span>
      <span className="min-w-0 text-right font-mono text-foreground tabular-nums">
        {value}
        {secondary ? <span className="text-muted-foreground"> · {secondary}</span> : null}
      </span>
    </div>
  );
}
