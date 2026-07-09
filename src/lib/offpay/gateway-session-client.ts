"use client";

import type { ConnectedStandardSolanaWallet } from "@privy-io/react-auth/solana";

import { createSessionNonce, verifyGatewaySession } from "./gateway-client";
import {
  readStoredGatewaySession,
  writeStoredGatewaySession,
} from "./gateway-session-storage";
import { signMessageForGatewaySession } from "./solana-transaction-signing";
import type { SolanaCluster, WebSessionVerification, WebWalletCustody } from "./types";

export async function ensureGatewaySession({
  cluster,
  gatewayOrigin,
  wallet,
  walletCustody,
}: {
  cluster: SolanaCluster;
  gatewayOrigin: string;
  wallet: ConnectedStandardSolanaWallet;
  walletCustody: WebWalletCustody;
}): Promise<WebSessionVerification> {
  const stored = readStoredGatewaySession({
    cluster,
    gatewayOrigin,
    walletAddress: wallet.address,
  });

  if (stored?.session.identity.custody === walletCustody) {
    return stored;
  }

  const nonce = await createSessionNonce(gatewayOrigin, {
    custody: walletCustody,
    network: cluster,
    walletAddress: wallet.address,
  });

  if (!nonce.ok) {
    throw new Error(nonce.error.message);
  }

  const signed = await signMessageForGatewaySession({
    message: nonce.data.message,
    wallet,
  });
  const verified = await verifyGatewaySession(gatewayOrigin, {
    challengeToken: nonce.data.challengeToken,
    custody: walletCustody,
    message: nonce.data.message,
    network: cluster,
    signature: signed.signature,
    signedMessage: signed.signedMessage,
    walletAddress: wallet.address,
  });

  if (!verified.ok) {
    throw new Error(verified.error.message);
  }

  writeStoredGatewaySession(
    {
      cluster,
      gatewayOrigin,
      walletAddress: wallet.address,
    },
    verified.data,
  );

  return verified.data;
}
