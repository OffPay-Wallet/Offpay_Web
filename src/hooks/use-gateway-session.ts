"use client";

import { useCallback, useState } from "react";
import {
  type ConnectedStandardSolanaWallet,
  useSignMessage,
} from "@privy-io/react-auth/solana";

import { getErrorMessage } from "@/lib/offpay/display";
import { createSessionNonce, verifyGatewaySession } from "@/lib/offpay/gateway-client";
import { writeStoredGatewaySession } from "@/lib/offpay/gateway-session-storage";
import type {
  SolanaCluster,
  WebSessionVerification,
  WebWalletCustody,
} from "@/lib/offpay/types";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

type UseGatewaySignInParams = {
  gatewayOrigin: string | undefined;
  cluster: SolanaCluster;
  walletAddress: string | undefined;
  walletCustody: WebWalletCustody | undefined;
  activeWallet: ConnectedStandardSolanaWallet | undefined;
  onSession: (verification: WebSessionVerification) => void;
};

type UseGatewaySignInResult = {
  signIn: () => Promise<void>;
  signing: boolean;
  error: string | null;
};

export function useGatewaySignIn({
  gatewayOrigin,
  cluster,
  walletAddress,
  walletCustody,
  activeWallet,
  onSession,
}: UseGatewaySignInParams): UseGatewaySignInResult {
  const { signMessage } = useSignMessage();
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback(async () => {
    setError(null);

    if (!gatewayOrigin || !walletAddress || !walletCustody || !activeWallet) {
      setError("Wallet session is not ready. Reconnect your wallet and try again.");
      return;
    }

    setSigning(true);

    try {
      const nonceEnvelope = await createSessionNonce(gatewayOrigin, {
        walletAddress,
        network: cluster,
        custody: walletCustody,
      });

      if (!nonceEnvelope.ok) {
        setError(nonceEnvelope.error.message);
        return;
      }

      const nonce = nonceEnvelope.data;
      const messageBytes = new TextEncoder().encode(nonce.message);
      const { signature } = await signMessage({ message: messageBytes, wallet: activeWallet });

      const verificationEnvelope = await verifyGatewaySession(gatewayOrigin, {
        walletAddress,
        network: cluster,
        custody: walletCustody,
        challengeToken: nonce.challengeToken,
        message: nonce.message,
        signature: bytesToBase64(signature),
        signedMessage: bytesToBase64(messageBytes),
      });

      if (!verificationEnvelope.ok) {
        setError(verificationEnvelope.error.message);
        return;
      }

      const verification = verificationEnvelope.data;
      writeStoredGatewaySession({ cluster, gatewayOrigin, walletAddress }, verification);
      onSession(verification);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setSigning(false);
    }
  }, [activeWallet, cluster, gatewayOrigin, onSession, signMessage, walletAddress, walletCustody]);

  return { signIn, signing, error };
}
