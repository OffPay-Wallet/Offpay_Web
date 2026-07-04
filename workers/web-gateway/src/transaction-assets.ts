import type {
  SolanaCluster,
  WalletTransactionAsset,
  WalletTransactionSignature,
  WalletTransactionSummary,
} from "../../../src/lib/offpay/types";
import { buildTransactionExplorerUrl } from "./explorer";
import { rpcRequest } from "./rpc-core";
import {
  fetchTokenDisplayMetadataForCluster,
  readRecord,
  readString,
  type TokenDisplayMetadata,
} from "./token-metadata";
import { classifyTransaction } from "./transaction-classifier";
import {
  mergeTokenAssets,
  pickInstructionAssets,
  pickNativeSolAsset,
  pickTokenAssetCandidates,
  tokenProgramIds,
  type TransactionAssetCandidate,
} from "./transaction-parser";
import type { GatewayEnv } from "./types";

type SignatureDetails = {
  assets: TransactionAssetCandidate[];
  summary: WalletTransactionSummary | null;
};

async function fetchOwnedTokenAccounts(
  url: string,
  address: string,
): Promise<ReadonlyMap<string, string>> {
  const accounts = new Map<string, string>();

  for (const programId of tokenProgramIds) {
    try {
      const rawResult = await rpcRequest(url, "getTokenAccountsByOwner", [
        address,
        { programId },
        { encoding: "jsonParsed" },
      ]);
      const result = readRecord(rawResult);
      const values = Array.isArray(result?.value) ? result.value : [];

      for (const item of values) {
        const record = readRecord(item);
        const pubkey = readString(record?.pubkey);
        const account = readRecord(record?.account);
        const data = readRecord(account?.data);
        const parsed = readRecord(data?.parsed);
        const info = readRecord(parsed?.info);
        const mint = readString(info?.mint);

        if (pubkey && mint) accounts.set(pubkey, mint);
      }
    } catch {
      // Current account ownership is a best-effort supplement for older parsed transactions.
    }
  }

  return accounts;
}

async function fetchSignatureDetails({
  address,
  cluster,
  failed,
  memo,
  ownedTokenAccounts,
  signature,
  url,
}: {
  address: string;
  cluster: SolanaCluster;
  failed: boolean;
  memo: string | null;
  ownedTokenAccounts: ReadonlyMap<string, string>;
  signature: string;
  url: string;
}): Promise<SignatureDetails> {
  try {
    const rawResult = await rpcRequest(url, "getTransaction", [
      signature,
      {
        encoding: "jsonParsed",
        maxSupportedTransactionVersion: 0,
      },
    ]);
    const transaction = readRecord(rawResult);

    if (!transaction) return { assets: [], summary: null };

    const tokenAssets = pickTokenAssetCandidates({ address, ownedTokenAccounts, transaction });
    const nativeSolAsset = pickNativeSolAsset({ address, transaction });
    const existingMints = new Set(tokenAssets.map((asset) => asset.mint));
    if (nativeSolAsset) existingMints.add(nativeSolAsset.mint);

    const assets = mergeTokenAssets([
      ...tokenAssets,
      ...pickInstructionAssets({
        address,
        existingMints,
        ownedTokenAccounts,
        transaction,
      }),
      ...(nativeSolAsset ? [nativeSolAsset] : []),
    ]);

    return {
      assets,
      summary: classifyTransaction({
        assets,
        cluster,
        failed,
        memo,
        transaction,
      }),
    };
  } catch {
    return { assets: [], summary: null };
  }
}

function buildTransactionAsset(
  asset: TransactionAssetCandidate,
  metadata: TokenDisplayMetadata | undefined,
): WalletTransactionAsset {
  return {
    mint: asset.mint,
    ...(asset.decimals != null ? { decimals: asset.decimals } : {}),
    ...(asset.rawAmountChange != null ? { rawAmountChange: asset.rawAmountChange } : {}),
    ...(asset.uiAmountChange != null ? { uiAmountChange: asset.uiAmountChange } : {}),
    ...(metadata?.logo ? { logo: metadata.logo } : {}),
    ...(metadata?.name ? { name: metadata.name } : {}),
    ...(metadata?.symbol ? { symbol: metadata.symbol } : {}),
  };
}

export async function enrichSignaturesWithAssets({
  address,
  cluster,
  env,
  signatures,
  url,
}: {
  address: string;
  cluster: SolanaCluster;
  env: GatewayEnv;
  signatures: WalletTransactionSignature[];
  url: string;
}): Promise<WalletTransactionSignature[]> {
  const ownedTokenAccounts = await fetchOwnedTokenAccounts(url, address);
  const signaturesWithDetails = await Promise.all(
    signatures.map(async (signature) => ({
      details: await fetchSignatureDetails({
        address,
        cluster,
        failed: signature.failed,
        memo: signature.memo,
        ownedTokenAccounts,
        signature: signature.signature,
        url,
      }),
      signature,
    })),
  );
  const mints = signaturesWithDetails.flatMap(({ details }) =>
    details.assets.map((asset) => asset.mint),
  );
  const metadataByMint = await fetchTokenDisplayMetadataForCluster({ cluster, env, mints });

  return signaturesWithDetails.map(({ details, signature }) => {
    const assets = details.assets.map((asset) =>
      buildTransactionAsset(asset, metadataByMint.get(asset.mint)),
    );
    const [asset] = assets;
    const explorerUrl = buildTransactionExplorerUrl({
      cluster,
      env,
      signature: signature.signature,
    });

    return {
      ...signature,
      ...(explorerUrl ? { explorerUrl } : {}),
      ...(asset ? { asset, assets } : {}),
      ...(details.summary ? { summary: details.summary } : {}),
    };
  });
}
