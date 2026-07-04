import { describe, expect, it } from "vitest";
import type { SignatureBytes } from "@solana/kit";
import type { SignableTransaction } from "@umbra-privacy/sdk";

import {
  mergeUmbraDecodedWalletTransaction,
  mergeUmbraTransactionSignatures,
} from "@/lib/offpay/umbra-wallet-signer";

function signatureBytes(fill: number): SignatureBytes {
  return new Uint8Array(64).fill(fill) as SignatureBytes;
}

describe("Umbra wallet signer", () => {
  it("preserves existing Umbra signatures when wallet output omits them", () => {
    const userSignature = signatureBytes(1);
    const proofSignature = signatureBytes(2);
    const transaction = {
      signatures: {
        ProofSigner111111111111111111111111111111111: proofSignature,
        UserSigner1111111111111111111111111111111111: null,
      },
    } as unknown as SignableTransaction;
    const walletSignatures = {
      ProofSigner111111111111111111111111111111111: null,
      UserSigner1111111111111111111111111111111111: userSignature,
    } as unknown as SignableTransaction["signatures"];

    const signed = mergeUmbraTransactionSignatures(transaction, walletSignatures);

    expect(signed.signatures.ProofSigner111111111111111111111111111111111).toBe(
      proofSignature,
    );
    expect(signed.signatures.UserSigner1111111111111111111111111111111111).toBe(
      userSignature,
    );
  });

  it("uses the wallet-returned transaction when the wallet changes the message", () => {
    const originalTransaction = {
      messageBytes: new Uint8Array([1, 2, 3]),
      signatures: {
        ProofSigner111111111111111111111111111111111: signatureBytes(2),
        UserSigner1111111111111111111111111111111111: null,
      },
    } as unknown as SignableTransaction;
    const walletTransaction = {
      messageBytes: new Uint8Array([4, 5, 6]),
      signatures: {
        UserSigner1111111111111111111111111111111111: signatureBytes(1),
      },
    } as unknown as SignableTransaction;

    const signed = mergeUmbraDecodedWalletTransaction(originalTransaction, walletTransaction);

    expect(signed).toBe(walletTransaction);
  });
});
