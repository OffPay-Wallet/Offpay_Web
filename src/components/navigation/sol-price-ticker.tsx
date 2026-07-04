"use client";

import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import {
  readGatewayTokenMetadata,
  readGatewayTokenPricesBatch,
} from "@/lib/offpay/gateway-client";
import { formatFiatValue } from "@/lib/offpay/number-format";
import { nativeSolMint } from "@/lib/offpay/portfolio-valuation";
import {
  getGatewayOrigin,
  getPublicSolanaCluster,
} from "@/lib/offpay/public-config";

const passthroughImageLoader = ({ src }: { src: string }) => src;

function httpsImageUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function SolPriceTicker() {
  const gatewayOrigin = getGatewayOrigin();
  const cluster = getPublicSolanaCluster();
  const query = useQuery({
    queryKey: ["global-sol-price", gatewayOrigin, cluster],
    enabled: Boolean(gatewayOrigin),
    queryFn: async () => {
      if (!gatewayOrigin) throw new Error("Gateway origin is not configured.");

      const envelope = await readGatewayTokenPricesBatch(gatewayOrigin, {
        currency: "USD",
        network: cluster,
        tokens: [{ mint: nativeSolMint, symbol: "SOL", priceSymbol: "SOL" }],
      });

      if (!envelope.ok) throw new Error(envelope.error.message);
      return envelope.data.unitUsdPrices[nativeSolMint] ?? null;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    retry: 1,
  });
  // SOL logo comes from the RPC (Helius DAS) token-metadata path — never Jupiter.
  const logoQuery = useQuery({
    queryKey: ["global-sol-logo", gatewayOrigin, cluster],
    enabled: Boolean(gatewayOrigin),
    queryFn: async () => {
      if (!gatewayOrigin) throw new Error("Gateway origin is not configured.");

      const envelope = await readGatewayTokenMetadata(gatewayOrigin, {
        network: cluster,
        mints: [nativeSolMint],
      });
      if (!envelope.ok) throw new Error(envelope.error.message);

      return envelope.data.metadata[nativeSolMint]?.logo ?? null;
    },
    staleTime: 24 * 60 * 60 * 1000,
    refetchInterval: false,
    refetchIntervalInBackground: false,
    retry: 1,
  });
  const price = query.data;
  const priceLabel = typeof price === "number" && price > 0 ? formatFiatValue(price) : "--";
  const logoSrc = httpsImageUrl(logoQuery.data ?? null);

  return (
    <div className="flex shrink-0 items-center gap-2" title="Live SOL price" aria-live="polite">
      {logoSrc ? <SolLogo src={logoSrc} /> : null}
      <span className="font-mono text-sm font-semibold leading-none tabular-nums text-foreground">
        {priceLabel}
      </span>
    </div>
  );
}

function SolLogo({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <Image
      key={src}
      src={src}
      alt=""
      width={24}
      height={24}
      className="h-6 w-6 shrink-0 rounded-full object-cover"
      loader={passthroughImageLoader}
      unoptimized
      referrerPolicy="no-referrer"
      aria-hidden="true"
      onError={() => setFailed(true)}
    />
  );
}
