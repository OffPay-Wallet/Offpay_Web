import type { SolanaCluster } from "./types";

export const defaultSolanaCluster: SolanaCluster = "solana:devnet";
export const offpayAppIconPath = "/assets/AppIcons/offpay-web.png";
export const offpayPrivyLogoPath = "/assets/AppIcons/offpay-privy-logo.png";

function nonEmptyEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function getPublicSolanaCluster(): SolanaCluster {
  const configured = process.env.NEXT_PUBLIC_SOLANA_CLUSTER;

  if (
    configured === "solana:devnet" ||
    configured === "solana:testnet" ||
    configured === "solana:mainnet"
  ) {
    return configured;
  }

  return defaultSolanaCluster;
}

export function getPrivyAppId(): string {
  return process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
}

export function getPrivyClientId(): string | undefined {
  const clientId = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID;
  return clientId && clientId.length > 0 ? clientId : undefined;
}

export function getGatewayOrigin(): string | undefined {
  return nonEmptyEnv(process.env.NEXT_PUBLIC_OFFPAY_GATEWAY_ORIGIN);
}

export function isOffpayDebugEnabled(): boolean {
  const configured = process.env.NEXT_PUBLIC_OFFPAY_DEBUG?.trim().toLowerCase();

  return (
    configured === "1" ||
    configured === "true" ||
    configured === "yes" ||
    configured === "on" ||
    configured === "debug" ||
    configured === "verbose"
  );
}
