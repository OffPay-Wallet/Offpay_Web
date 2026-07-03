import type { SolanaCluster } from "./types";

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unexpected wallet error.";
}

export function truncateAddress(address: string, visibleChars = 4): string {
  if (address.length <= visibleChars * 2 + 3) {
    return address;
  }

  return `${address.slice(0, visibleChars)}...${address.slice(-visibleChars)}`;
}

export function formatCluster(cluster: SolanaCluster | string): string {
  const name = cluster.replace("solana:", "");

  return name.charAt(0).toUpperCase() + name.slice(1);
}
