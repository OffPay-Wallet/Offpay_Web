import type {
  UmbraVaultHolding,
  WalletPortfolio,
  WalletTokenBalance,
} from "@/lib/offpay/types";

export type VaultAction = "shield" | "unshield";

export type VaultValidationResult =
  | { ok: true }
  | {
      ok: false;
      field?: "amount";
      message: string;
      retryBalances?: true;
    };

const nativeSolMint = "So11111111111111111111111111111111111111112";

export function decimalToAtomic(value: string, decimals: number): bigint | null {
  const trimmed = value.trim();

  if (!/^\d+(?:\.\d*)?$/.test(trimmed)) return null;

  const [whole = "0", fractional = ""] = trimmed.split(".");
  if (fractional.length > decimals) return null;

  try {
    const scale = 10n ** BigInt(decimals);
    const wholeAtomic = BigInt(whole || "0") * scale;
    const paddedFractional = fractional.padEnd(decimals, "0");
    const fractionalAtomic = paddedFractional ? BigInt(paddedFractional) : 0n;

    return wholeAtomic + fractionalAtomic;
  } catch {
    return null;
  }
}

export function readAtomicAmount(value: string | undefined): bigint | null {
  if (!value) return null;

  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

export function formatAtomicAmount(value: bigint, decimals: number): string {
  if (decimals <= 0) return value.toString();

  const scale = 10n ** BigInt(decimals);
  const whole = value / scale;
  const fractional = value % scale;
  const fractionalLabel = fractional
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");

  return fractionalLabel ? `${whole}.${fractionalLabel}` : whole.toString();
}

function findPublicToken(
  portfolio: WalletPortfolio | undefined,
  holding: UmbraVaultHolding,
): WalletTokenBalance | undefined {
  return portfolio?.tokens.find((token) => token.mint === holding.mint);
}

function amountError(amount: string, holding: UmbraVaultHolding | null): string | null {
  const trimmed = amount.trim();

  if (!trimmed) return "Enter an amount.";
  if (holding?.decimals == null) return "Token decimals are unavailable. Refresh vault.";

  const atomicAmount = decimalToAtomic(trimmed, holding.decimals);
  if (atomicAmount == null) return `Use a valid ${holding.symbol} amount.`;
  if (atomicAmount <= 0n) return "Amount must be greater than zero.";

  return null;
}

function solFundingError(
  portfolio: WalletPortfolio,
  feeReserveLamports: bigint | null | undefined,
): string | null {
  const reserveLamports = feeReserveLamports && feeReserveLamports > 0n ? feeReserveLamports : 0n;
  if (reserveLamports === 0n) return null;

  const lamports = readAtomicAmount(portfolio.sol.lamports);

  if (lamports == null) return "Unable to verify SOL fee balance.";
  if (lamports >= reserveLamports) return null;

  return `Need at least ${formatAtomicAmount(
    reserveLamports,
    9,
  )} SOL for Umbra setup and network fees.`;
}

function nativeSolSpendableAmount(
  portfolio: WalletPortfolio,
  feeReserveLamports: bigint | null | undefined,
): bigint | null {
  const lamports = readAtomicAmount(portfolio.sol.lamports);
  const reserveLamports = feeReserveLamports && feeReserveLamports > 0n ? feeReserveLamports : 0n;

  if (lamports == null) return null;
  if (lamports <= reserveLamports) return 0n;
  return lamports - reserveLamports;
}

export function validateUmbraVaultPreflight({
  action,
  amount,
  holding,
  portfolio,
  portfolioError,
  portfolioLoading,
  feeReserveLamports,
  walletReady,
}: {
  action: VaultAction;
  amount: string;
  feeReserveLamports?: bigint | null;
  holding: UmbraVaultHolding | null;
  portfolio: WalletPortfolio | undefined;
  portfolioError: Error | null;
  portfolioLoading: boolean;
  walletReady: boolean;
}): VaultValidationResult {
  if (!walletReady) return { ok: false, message: "Connect wallet first." };
  if (!holding) return { ok: false, message: "Select a supported token." };

  const fieldMessage = amountError(amount, holding);
  if (fieldMessage) return { ok: false, field: "amount", message: fieldMessage };

  if (holding.decimals == null) {
    return { ok: false, message: "Token decimals are unavailable. Refresh vault." };
  }

  const amountAtomic = decimalToAtomic(amount, holding.decimals);
  if (amountAtomic == null) {
    return { ok: false, field: "amount", message: `Use a valid ${holding.symbol} amount.` };
  }

  const actionAllowed =
    action === "shield" ? holding.depositEnabled : holding.stealthPoolEnabled;
  if (!actionAllowed) {
    return {
      ok: false,
      message: `${holding.symbol} is not available for ${action} right now.`,
    };
  }

  if (portfolioLoading) {
    return { ok: false, message: "Checking public balances. Try again in a moment." };
  }

  if (portfolioError || !portfolio) {
    return {
      ok: false,
      message: "Unable to verify public balances.",
      retryBalances: true,
    };
  }

  if (action === "shield") {
    return validateShieldPreflight({ amountAtomic, feeReserveLamports, holding, portfolio });
  }

  return validateUnshieldPreflight({ amountAtomic, feeReserveLamports, holding, portfolio });
}

function validateShieldPreflight({
  amountAtomic,
  feeReserveLamports,
  holding,
  portfolio,
}: {
  amountAtomic: bigint;
  feeReserveLamports: bigint | null | undefined;
  holding: UmbraVaultHolding;
  portfolio: WalletPortfolio;
}): VaultValidationResult {
  const publicToken = findPublicToken(portfolio, holding);
  const publicAmount =
    holding.mint === nativeSolMint && !publicToken && portfolio
      ? nativeSolSpendableAmount(portfolio, feeReserveLamports)
      : readAtomicAmount(publicToken?.amount);

  if (publicAmount == null || (holding.mint !== nativeSolMint && !publicToken)) {
    return { ok: false, message: `No spendable ${holding.symbol} balance found.` };
  }

  if (amountAtomic > publicAmount) {
    return {
      ok: false,
      field: "amount",
      message: `Insufficient ${holding.symbol}. Available: ${formatAtomicAmount(
        publicAmount,
        holding.decimals ?? 0,
      )} ${holding.symbol}.`,
    };
  }

  const feeMessage = solFundingError(portfolio, feeReserveLamports);
  return feeMessage ? { ok: false, message: feeMessage } : { ok: true };
}

function validateUnshieldPreflight({
  amountAtomic,
  feeReserveLamports,
  holding,
  portfolio,
}: {
  amountAtomic: bigint;
  feeReserveLamports: bigint | null | undefined;
  holding: UmbraVaultHolding;
  portfolio: WalletPortfolio;
}): VaultValidationResult {
  if (holding.decimals == null) {
    return { ok: false, message: "Token decimals are unavailable. Refresh vault." };
  }
  if (holding.uiAmountString == null) {
    const feeMessage = solFundingError(portfolio, feeReserveLamports);
    return feeMessage ? { ok: false, message: feeMessage } : { ok: true };
  }

  const shieldedAmount = decimalToAtomic(holding.uiAmountString, holding.decimals);
  if (shieldedAmount == null) {
    return { ok: false, message: `Unable to verify encrypted ${holding.symbol} balance.` };
  }
  if (amountAtomic > shieldedAmount) {
    return {
      ok: false,
      field: "amount",
      message: `Insufficient shielded ${holding.symbol}. Available: ${formatAtomicAmount(
        shieldedAmount,
        holding.decimals,
      )} ${holding.symbol}.`,
    };
  }

  const feeMessage = solFundingError(portfolio, feeReserveLamports);
  return feeMessage ? { ok: false, message: feeMessage } : { ok: true };
}

/**
 * The spendable atomic amount for the active side of the flow. Shield reads the
 * public wallet balance (SOL is net of the fee reserve); unshield reads the
 * decrypted shielded balance. Returned value is exactly what preflight
 * validates against, so "Max" and quick-fill chips can never overshoot.
 */
export function umbraVaultAvailableAtomic({
  action,
  feeReserveLamports,
  holding,
  portfolio,
}: {
  action: VaultAction;
  feeReserveLamports?: bigint | null;
  holding: UmbraVaultHolding | null;
  portfolio: WalletPortfolio | undefined;
}): bigint | null {
  if (!holding || holding.decimals == null) return null;

  if (action === "unshield") {
    if (holding.uiAmountString == null) return null;
    return decimalToAtomic(holding.uiAmountString, holding.decimals);
  }

  if (!portfolio) return null;

  const publicToken = findPublicToken(portfolio, holding);
  if (holding.mint === nativeSolMint && !publicToken) {
    return nativeSolSpendableAmount(portfolio, feeReserveLamports);
  }

  return readAtomicAmount(publicToken?.amount);
}

export function umbraVaultBalanceHint({
  action,
  holding,
  feeReserveLamports,
  portfolio,
  portfolioError,
  portfolioLoading,
}: {
  action: VaultAction;
  feeReserveLamports?: bigint | null;
  holding: UmbraVaultHolding | null;
  portfolio: WalletPortfolio | undefined;
  portfolioError: Error | null;
  portfolioLoading: boolean;
}): string | null {
  if (!holding) return null;

  if (action === "unshield") {
    return holding.uiAmountString == null
      ? "Encrypted balance checks on confirm"
      : `Shielded: ${holding.uiAmountString} ${holding.symbol}`;
  }

  if (portfolioLoading) return "Checking public balance";
  if (portfolioError) return "Public balance unavailable";

  const publicToken = findPublicToken(portfolio, holding);
  const publicAmount =
    holding.mint === nativeSolMint && !publicToken && portfolio
      ? nativeSolSpendableAmount(portfolio, feeReserveLamports)
      : readAtomicAmount(publicToken?.amount);

  if (!publicToken && holding.mint !== nativeSolMint) return `Available: 0 ${holding.symbol}`;
  if (publicAmount == null || holding.decimals == null) return "Available balance unavailable";

  return `Available: ${formatAtomicAmount(publicAmount, holding.decimals)} ${
    holding.symbol
  }`;
}
