import type { ConnectedStandardSolanaWallet } from "@privy-io/react-auth/solana";

import { base64ToBytes, bytesToBase64 } from "./base64";

const solanaSignTransaction = "solana:signTransaction";
const solanaSignMessage = "solana:signMessage";
const textEncoder = new TextEncoder();

type StandardWalletAccount = ConnectedStandardSolanaWallet["standardWallet"]["accounts"][number];

type SignTransactionFeature = {
  readonly signTransaction: (
    ...inputs: readonly {
      readonly account: StandardWalletAccount;
      readonly transaction: Uint8Array;
    }[]
  ) => Promise<readonly { readonly signedTransaction: Uint8Array }[]>;
};

type SignMessageFeature = {
  readonly signMessage: (
    ...inputs: readonly {
      readonly account: StandardWalletAccount;
      readonly message: Uint8Array;
    }[]
  ) => Promise<readonly { readonly signature: Uint8Array }[]>;
};

function readFeature<TFeature>(
  wallet: ConnectedStandardSolanaWallet,
  featureName: string,
  methodName: string,
): TFeature {
  const features = wallet.standardWallet.features as Readonly<Record<string, unknown>>;
  const feature = features[featureName] as TFeature | undefined;
  const method = (feature as Record<string, unknown> | undefined)?.[methodName];

  if (!feature || typeof method !== "function") {
    throw new Error(`Wallet "${wallet.standardWallet.name}" does not support "${featureName}".`);
  }

  return feature;
}

function readSignTransactionFeature(wallet: ConnectedStandardSolanaWallet): SignTransactionFeature {
  return readFeature<SignTransactionFeature>(
    wallet,
    solanaSignTransaction,
    "signTransaction",
  );
}

function readSignMessageFeature(wallet: ConnectedStandardSolanaWallet): SignMessageFeature {
  return readFeature<SignMessageFeature>(wallet, solanaSignMessage, "signMessage");
}

function findWalletAccount(wallet: ConnectedStandardSolanaWallet): StandardWalletAccount {
  const account = wallet.standardWallet.accounts.find(
    (candidate) => candidate.address === wallet.address,
  );

  if (!account) {
    throw new Error("Connected wallet account is not ready.");
  }

  return account;
}

export async function signSerializedTransactionBase64({
  transactionBase64,
  wallet,
}: {
  transactionBase64: string;
  wallet: ConnectedStandardSolanaWallet;
}): Promise<string> {
  const output = (
    await readSignTransactionFeature(wallet).signTransaction({
      account: findWalletAccount(wallet),
      transaction: base64ToBytes(transactionBase64),
    })
  )[0];

  if (!output) {
    throw new Error("Wallet did not return a signed transaction.");
  }

  return bytesToBase64(output.signedTransaction);
}

export async function signMessageForGatewaySession({
  message,
  wallet,
}: {
  message: string;
  wallet: ConnectedStandardSolanaWallet;
}): Promise<{ signature: string; signedMessage: string }> {
  const messageBytes = textEncoder.encode(message);
  const output = (
    await readSignMessageFeature(wallet).signMessage({
      account: findWalletAccount(wallet),
      message: messageBytes,
    })
  )[0];

  if (!output) {
    throw new Error("Wallet did not return a message signature.");
  }

  return {
    signature: bytesToBase64(output.signature),
    signedMessage: bytesToBase64(messageBytes),
  };
}
