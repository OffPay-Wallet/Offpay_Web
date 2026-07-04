import { address, getTransactionDecoder, getTransactionEncoder } from "@solana/kit";
import type {
  CreateSignerFromWalletAccountArgs,
  IUmbraSigner,
  SignedMessage,
  SignedTransaction,
  SignableTransaction,
} from "@umbra-privacy/sdk";

import { debugLog, debugWarn } from "./debug";

const solanaSignTransaction = "solana:signTransaction";
const solanaSignMessage = "solana:signMessage";

type SignTransactionFeature = {
  readonly signTransaction: (
    ...inputs: readonly {
      readonly account: CreateSignerFromWalletAccountArgs["account"];
      readonly transaction: Uint8Array;
    }[]
  ) => Promise<readonly { readonly signedTransaction: Uint8Array }[]>;
};

type SignMessageFeature = {
  readonly signMessage: (
    ...inputs: readonly {
      readonly account: CreateSignerFromWalletAccountArgs["account"];
      readonly message: Uint8Array;
    }[]
  ) => Promise<readonly { readonly signature: Uint8Array }[]>;
};

function readFeature<TFeature>(
  wallet: CreateSignerFromWalletAccountArgs["wallet"],
  featureName: string,
  methodName: string,
): TFeature {
  const features = wallet.features as Readonly<Record<string, unknown>>;
  const feature = features[featureName] as TFeature | undefined;
  const method = (feature as Record<string, unknown> | undefined)?.[methodName];

  if (!feature || typeof method !== "function") {
    throw new Error(`Wallet "${wallet.name}" does not support "${featureName}".`);
  }

  return feature;
}

type BytesLike = {
  readonly length: number;
  readonly [index: number]: number;
};

function bytesEqual(first: BytesLike, second: BytesLike): boolean {
  if (first.length !== second.length) return false;

  for (let index = 0; index < first.length; index += 1) {
    if (first[index] !== second[index]) return false;
  }

  return true;
}

function requireOutput<TOutput>(output: TOutput | undefined, action: string): TOutput {
  if (!output) throw new Error(`Wallet did not return ${action} output.`);

  return output;
}

function messageCacheKey(message: Uint8Array): string {
  let key = "";
  for (let index = 0; index < message.length; index += 1) {
    key += (message[index] ?? 0).toString(16).padStart(2, "0");
  }
  return key;
}

export function mergeUmbraTransactionSignatures(
  transaction: SignableTransaction,
  walletSignatures: SignableTransaction["signatures"],
): SignedTransaction {
  const signatures = { ...transaction.signatures } as Record<string, unknown>;
  for (const [address, signature] of Object.entries(walletSignatures)) {
    if (signature) signatures[address] = signature;
  }

  return {
    ...transaction,
    signatures: Object.freeze(signatures),
  } as SignedTransaction;
}

function countResolvedSignatures(signatures: SignableTransaction["signatures"]): number {
  return Object.values(signatures).filter(Boolean).length;
}

function hasSignerSignature(transaction: SignedTransaction, signerAddress: string): boolean {
  return Boolean((transaction.signatures as Record<string, unknown>)[signerAddress]);
}

export function mergeUmbraDecodedWalletTransaction(
  transaction: SignableTransaction,
  decoded: SignableTransaction,
): SignedTransaction {
  if (!bytesEqual(decoded.messageBytes, transaction.messageBytes)) {
    debugWarn("umbra.wallet_sign.message_changed", {
      inputResolvedSignatureCount: countResolvedSignatures(transaction.signatures),
      walletResolvedSignatureCount: countResolvedSignatures(decoded.signatures),
    });
    return decoded as SignedTransaction;
  }

  return mergeUmbraTransactionSignatures(transaction, decoded.signatures);
}

function mergeWalletSignatures(
  transaction: SignableTransaction,
  signedTransaction: Uint8Array,
): SignedTransaction {
  const decoded = getTransactionDecoder().decode(signedTransaction);
  return mergeUmbraDecodedWalletTransaction(transaction, decoded as SignableTransaction);
}

function assertSignerSignature(transaction: SignedTransaction, signerAddress: string) {
  if (hasSignerSignature(transaction, signerAddress)) return;

  throw new Error("Wallet did not attach the Umbra transaction signature.");
}

export function createUmbraWalletSigner({
  account,
  wallet,
}: CreateSignerFromWalletAccountArgs): IUmbraSigner {
  const signerAddress = address(account.address);
  const signTransactionFeature = readFeature<SignTransactionFeature>(
    wallet,
    solanaSignTransaction,
    "signTransaction",
  );
  const signMessageFeature = readFeature<SignMessageFeature>(
    wallet,
    solanaSignMessage,
    "signMessage",
  );
  const encoder = getTransactionEncoder();
  // The Umbra SDK derives the master seed through two independent paths
  // (getMasterSeed and getSchemeMasterSeed), each of which signs the identical
  // consent message. Memoizing by message content collapses those into a single
  // wallet prompt, and caching the in-flight promise also dedupes concurrent calls.
  const messageSignatureCache = new Map<string, Promise<SignedMessage>>();

  return {
    address: signerAddress,
    signMessage: (message): Promise<SignedMessage> => {
      const cacheKey = messageCacheKey(message);
      const cached = messageSignatureCache.get(cacheKey);
      if (cached) return cached;

      const pending = (async (): Promise<SignedMessage> => {
        const output = requireOutput(
          (await signMessageFeature.signMessage({ account, message }))[0],
          "message signature",
        );

        return {
          message,
          signature: output.signature as SignedMessage["signature"],
          signer: signerAddress,
        };
      })();

      messageSignatureCache.set(cacheKey, pending);
      pending.catch(() => {
        messageSignatureCache.delete(cacheKey);
      });
      return pending;
    },
    signTransaction: async (transaction) => {
      debugLog("umbra.wallet_sign.start", {
        inputRequiredSignatureCount: Object.keys(transaction.signatures).length,
        inputResolvedSignatureCount: countResolvedSignatures(transaction.signatures),
        walletName: wallet.name,
      });
      const output = requireOutput(
        (await signTransactionFeature.signTransaction({
          account,
          transaction: new Uint8Array(encoder.encode(transaction)),
        }))[0],
        "transaction signature",
      );
      const signed = mergeWalletSignatures(transaction, output.signedTransaction);
      assertSignerSignature(signed, signerAddress);
      debugLog("umbra.wallet_sign.complete", {
        outputRequiredSignatureCount: Object.keys(signed.signatures).length,
        outputResolvedSignatureCount: countResolvedSignatures(signed.signatures),
        walletName: wallet.name,
      });

      return signed;
    },
    signTransactions: async (transactions) => {
      debugLog("umbra.wallet_batch_sign.start", {
        transactionCount: transactions.length,
        walletName: wallet.name,
      });
      const outputs = await signTransactionFeature.signTransaction(
        ...transactions.map((transaction) => ({
          account,
          transaction: new Uint8Array(encoder.encode(transaction)),
        })),
      );

      const signedTransactions = transactions.map((transaction, index) => {
        const signed = mergeWalletSignatures(
          transaction,
          requireOutput(outputs[index], "transaction signature").signedTransaction,
        );
        assertSignerSignature(signed, signerAddress);
        return signed;
      });
      debugLog("umbra.wallet_batch_sign.complete", {
        transactionCount: signedTransactions.length,
        walletName: wallet.name,
      });

      return signedTransactions;
    },
  };
}
