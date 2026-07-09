"use client";

import type { ConnectedStandardSolanaWallet } from "@privy-io/react-auth/solana";
import { useQuery } from "@tanstack/react-query";

import {
  readGatewayMinimumBalanceForRentExemption,
  readGatewayTokenPricesBatch,
} from "@/lib/offpay/gateway-client";
import { ensureGatewaySession } from "@/lib/offpay/gateway-session-client";
import { nativeSolMint } from "@/lib/offpay/portfolio-valuation";
import { requestGatewayMagicBlockPrivateSend } from "@/lib/offpay/private-send-gateway-client";
import {
  quoteMagicBlockPrivateSendFees,
  quoteUmbraPrivateSendFees,
  type PrivateSendFeeQuote,
} from "@/lib/offpay/private-send-fees";
import type { PrivateSendProvider, PrivateSendToken } from "@/lib/offpay/private-send";
import type {
  MagicBlockUnsignedPrivateTransfer,
  SolanaCluster,
  WebWalletCustody,
} from "@/lib/offpay/types";

type MagicBlockFeeDraft = {
  prepared: MagicBlockUnsignedPrivateTransfer;
  sessionToken: string;
};

type FeePreviewData =
  | {
      magicBlockDraft: MagicBlockFeeDraft;
      provider: "magicblock";
      quote: PrivateSendFeeQuote;
    }
  | {
      magicBlockDraft: null;
      provider: "umbra";
      quote: PrivateSendFeeQuote;
    };

type FeePreviewInput = {
  activeWallet: ConnectedStandardSolanaWallet | undefined;
  amountAtomic: bigint | null;
  cluster: SolanaCluster;
  enabled: boolean;
  gatewayOrigin: string | undefined;
  memo: string;
  provider: PrivateSendProvider;
  recipient: string;
  selectedToken: PrivateSendToken | null;
  walletCustody: WebWalletCustody | undefined;
};

async function prepareMagicBlockQuote({
  activeWallet,
  amountAtomic,
  cluster,
  gatewayOrigin,
  memo,
  recipient,
  selectedToken,
  walletCustody,
}: FeePreviewInput & {
  amountAtomic: bigint;
  gatewayOrigin: string;
  selectedToken: PrivateSendToken;
  walletCustody: WebWalletCustody;
}): Promise<FeePreviewData> {
  if (!activeWallet) throw new Error("Connect a Solana wallet to estimate fees.");
  if (amountAtomic > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("MagicBlock supports this token up to the safe integer amount limit.");
  }

  const session = await ensureGatewaySession({
    cluster,
    gatewayOrigin,
    wallet: activeWallet,
    walletCustody,
  });
  const envelope = await requestGatewayMagicBlockPrivateSend(gatewayOrigin, {
    action: "prepare",
    amountAtomic: amountAtomic.toString(),
    mint: selectedToken.mint,
    provider: "magicblock",
    recipient: recipient.trim(),
    sessionToken: session.sessionToken,
    ...(memo.trim() ? { memo: memo.trim() } : {}),
  });

  if (!envelope.ok) throw new Error(envelope.error.message);

  const prepared = envelope.data as MagicBlockUnsignedPrivateTransfer;
  return {
    magicBlockDraft: { prepared, sessionToken: session.sessionToken },
    provider: "magicblock",
    quote: quoteMagicBlockPrivateSendFees({ amountAtomic, prepared }),
  };
}

export function usePrivateSendFeePreview(input: FeePreviewInput) {
  const quoteQuery = useQuery({
    enabled: input.enabled,
    queryKey: [
      "private-send-fee-preview",
      input.gatewayOrigin,
      input.cluster,
      input.provider,
      input.activeWallet?.address,
      input.walletCustody,
      input.selectedToken?.mint,
      input.amountAtomic?.toString() ?? null,
      input.recipient.trim(),
      input.provider === "magicblock" ? input.memo.trim() : "",
    ],
    queryFn: async (): Promise<FeePreviewData> => {
      if (!input.gatewayOrigin || !input.selectedToken || !input.amountAtomic) {
        throw new Error("Complete the payment details to estimate fees.");
      }

      if (input.provider === "magicblock") {
        if (!input.walletCustody) throw new Error("Connect a Solana wallet to estimate fees.");
        return prepareMagicBlockQuote({
          ...input,
          amountAtomic: input.amountAtomic,
          gatewayOrigin: input.gatewayOrigin,
          selectedToken: input.selectedToken,
          walletCustody: input.walletCustody,
        });
      }

      const networkFeeLamports = await readGatewayMinimumBalanceForRentExemption(
        input.gatewayOrigin,
        {
          network: input.cluster,
          space: 165,
        },
      );
      return {
        magicBlockDraft: null,
        provider: "umbra",
        quote: await quoteUmbraPrivateSendFees({
          amountAtomic: input.amountAtomic,
          networkFeeLamports,
        }),
      };
    },
    refetchOnWindowFocus: false,
    retry: 1,
    staleTime: 10_000,
  });
  const priceQuery = useQuery({
    enabled: Boolean(input.gatewayOrigin && input.selectedToken),
    queryKey: [
      "private-send-fee-prices",
      input.gatewayOrigin,
      input.cluster,
      input.selectedToken?.mint,
    ],
    queryFn: async () => {
      if (!input.gatewayOrigin || !input.selectedToken) {
        throw new Error("Token price inputs are missing.");
      }

      const envelope = await readGatewayTokenPricesBatch(input.gatewayOrigin, {
        currency: "USD",
        network: input.cluster,
        tokens: [
          { mint: nativeSolMint, priceSymbol: "SOL", symbol: "SOL" },
          {
            mint: input.selectedToken.mint,
            priceSymbol: input.selectedToken.symbol,
            symbol: input.selectedToken.symbol,
          },
        ],
      });

      if (!envelope.ok) throw new Error(envelope.error.message);
      return envelope.data.unitUsdPrices;
    },
    refetchOnWindowFocus: false,
    retry: 1,
    staleTime: 30_000,
  });

  return {
    errorMessage: quoteQuery.error instanceof Error ? quoteQuery.error.message : null,
    isLoading: input.enabled && quoteQuery.isFetching,
    isReady: quoteQuery.isSuccess,
    magicBlockDraft: quoteQuery.data?.magicBlockDraft ?? null,
    quote: quoteQuery.data?.quote ?? null,
    solPriceUsd: priceQuery.data?.[nativeSolMint] ?? null,
    tokenPriceUsd: input.selectedToken ? priceQuery.data?.[input.selectedToken.mint] ?? null : null,
  };
}
