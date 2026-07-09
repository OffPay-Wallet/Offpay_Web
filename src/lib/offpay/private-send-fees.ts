import { getHardcodedCreateUtxoProtocolFeeProvider } from "@umbra-privacy/sdk/fee-provider";
import { BPS_DIVISOR } from "@umbra-privacy/sdk/shared";

import type { PrivateSendProvider } from "./private-send";
import type { MagicBlockUnsignedPrivateTransfer } from "./types";

export type PrivateSendFeeQuote = {
  minReceivedAtomic: bigint;
  networkFeeLamports: bigint | null;
  provider: PrivateSendProvider;
  tokenFeeAtomic: bigint;
};

function parseAtomic(value: string | undefined): bigint {
  if (!value || !/^\d+$/.test(value)) return 0n;
  return BigInt(value);
}

function minReceived(amountAtomic: bigint, tokenFeeAtomic: bigint): bigint {
  const received = amountAtomic - tokenFeeAtomic;
  return received > 0n ? received : 0n;
}

export function quoteMagicBlockPrivateSendFees({
  amountAtomic,
  prepared,
}: {
  amountAtomic: bigint;
  prepared: MagicBlockUnsignedPrivateTransfer;
}): PrivateSendFeeQuote {
  const tokenFeeAtomic = parseAtomic(prepared.fees?.tokens);
  const networkFeeLamports = parseAtomic(prepared.fees?.lamports);

  return {
    minReceivedAtomic: minReceived(amountAtomic, tokenFeeAtomic),
    networkFeeLamports,
    provider: "magicblock",
    tokenFeeAtomic,
  };
}

export async function quoteUmbraPrivateSendFees({
  amountAtomic,
  networkFeeLamports,
}: {
  amountAtomic: bigint;
  networkFeeLamports: bigint | null;
}): Promise<PrivateSendFeeQuote> {
  const feeProvider = getHardcodedCreateUtxoProtocolFeeProvider();
  const feeConfig = await feeProvider();
  const tokenFeeAtomic = (amountAtomic * feeConfig.feeBasisPoints) / BPS_DIVISOR;

  return {
    minReceivedAtomic: minReceived(amountAtomic, tokenFeeAtomic),
    networkFeeLamports,
    provider: "umbra",
    tokenFeeAtomic,
  };
}
