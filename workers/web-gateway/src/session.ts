import {
  address,
  getPublicKeyFromAddress,
  signatureBytes,
  verifySignature,
} from "@solana/kit";
import { z } from "zod";

import type {
  SolanaCluster,
  WebWalletCustody,
  WebSession,
  WebSessionNonce,
} from "../../../src/lib/offpay/types";

const sessionTtlMs = 1000 * 60 * 60 * 24 * 7;
const challengeTtlMs = 1000 * 60 * 5;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const walletCustodySchema = z.literal("external-solana");

const challengePayloadSchema = z.object({
  type: z.literal("offpay-web-challenge"),
  walletAddress: z.string().min(32),
  network: z.enum(["solana:devnet", "solana:testnet", "solana:mainnet"]),
  custody: walletCustodySchema,
  nonce: z.string().min(16),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  deviceId: z.string().min(1).optional(),
});

const sessionPayloadSchema = z.object({
  type: z.literal("offpay-web-session"),
  id: z.string().min(16),
  identity: z.object({
    address: z.string().min(32),
    cluster: z.enum(["solana:devnet", "solana:testnet", "solana:mainnet"]),
    custody: walletCustodySchema,
    privyUserId: z.string().min(1).optional(),
  }),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  deviceId: z.string().min(1).optional(),
});

type ChallengePayload = z.infer<typeof challengePayloadSchema>;
type SessionPayload = z.infer<typeof sessionPayloadSchema>;

type VerifyChallengeInput = {
  challengeToken: string;
  walletAddress: string;
  network: SolanaCluster;
  custody: WebWalletCustody;
  message: string;
  signature: string;
  signedMessage: string;
  deviceId?: string;
};

type VerificationResult =
  | {
      ok: true;
      session: WebSession;
    }
  | {
      ok: false;
      reason: string;
    };

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";

  for (let index = 0; index < bytes.length; index += 1) {
    const byte = bytes[index];

    if (byte === undefined) {
      throw new Error("Cannot encode sparse byte array.");
    }

    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64ToBytes(value: string): Uint8Array {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function base64UrlToBytes(value: string): Uint8Array {
  return base64ToBytes(value.replaceAll("-", "+").replaceAll("_", "/"));
}

function randomToken(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

async function hmac(secret: string, value: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(value));

  return new Uint8Array(signature);
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftByte = left[index];
    const rightByte = right[index];

    if (leftByte === undefined || rightByte === undefined) {
      return false;
    }

    diff |= leftByte ^ rightByte;
  }

  return diff === 0;
}

async function signPayload(payload: object, secret: string): Promise<string> {
  const encodedPayload = bytesToBase64Url(textEncoder.encode(JSON.stringify(payload)));
  const signature = await hmac(secret, encodedPayload);

  return `${encodedPayload}.${bytesToBase64Url(signature)}`;
}

async function verifyPayload(token: string, secret: string): Promise<unknown | null> {
  const [encodedPayload, encodedSignature] = token.split(".");

  if (!encodedPayload || !encodedSignature) {
    return null;
  }

  const expected = await hmac(secret, encodedPayload);
  const actual = base64UrlToBytes(encodedSignature);

  if (!timingSafeEqual(expected, actual)) {
    return null;
  }

  const json = textDecoder.decode(base64UrlToBytes(encodedPayload));
  return JSON.parse(json) as unknown;
}

export function buildSessionMessage(payload: ChallengePayload): string {
  return [
    "Sign in to Offpay Web",
    "",
    "This signature creates a browser session for the Offpay Web Gateway.",
    "It cannot move funds.",
    "",
    `Wallet: ${payload.walletAddress}`,
    `Network: ${payload.network}`,
    `Custody: ${payload.custody}`,
    `Nonce: ${payload.nonce}`,
    `Issued At: ${payload.issuedAt}`,
    `Expires At: ${payload.expiresAt}`,
  ].join("\n");
}

export async function createChallenge({
  deviceId,
  custody,
  network,
  now = new Date(),
  secret,
  walletAddress,
}: {
  walletAddress: string;
  network: SolanaCluster;
  custody: WebWalletCustody;
  secret: string;
  now?: Date;
  deviceId?: string;
}): Promise<WebSessionNonce> {
  const issuedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + challengeTtlMs).toISOString();
  const payload = challengePayloadSchema.parse({
    type: "offpay-web-challenge",
    walletAddress,
    network,
    custody,
    nonce: randomToken(24),
    issuedAt,
    expiresAt,
    deviceId,
  });
  const challengeToken = await signPayload(payload, secret);

  return {
    challengeToken,
    expiresAt,
    message: buildSessionMessage(payload),
    nonce: payload.nonce,
  };
}

export async function verifyChallenge(
  input: VerifyChallengeInput,
  secret: string,
  now = new Date(),
): Promise<VerificationResult> {
  const rawPayload = await verifyPayload(input.challengeToken, secret);
  const parsedPayload = challengePayloadSchema.safeParse(rawPayload);

  if (!parsedPayload.success) {
    return {
      ok: false,
      reason: "Invalid session challenge.",
    };
  }

  const payload = parsedPayload.data;
  const expectedMessage = buildSessionMessage(payload);

  if (
    payload.walletAddress !== input.walletAddress ||
    payload.network !== input.network ||
    payload.custody !== input.custody ||
    input.message !== expectedMessage
  ) {
    return {
      ok: false,
      reason: "Session challenge does not match the signed wallet context.",
    };
  }

  if (new Date(payload.expiresAt).getTime() <= now.getTime()) {
    return {
      ok: false,
      reason: "Session challenge expired.",
    };
  }

  const signedMessageBytes = base64ToBytes(input.signedMessage);

  if (textDecoder.decode(signedMessageBytes) !== expectedMessage) {
    return {
      ok: false,
      reason: "Signed message does not match the Offpay challenge.",
    };
  }

  try {
    const publicKey = await getPublicKeyFromAddress(address(input.walletAddress));
    const verified = await verifySignature(
      publicKey,
      signatureBytes(base64ToBytes(input.signature)),
      signedMessageBytes,
    );

    if (!verified) {
      return {
        ok: false,
        reason: "Wallet signature verification failed.",
      };
    }
  } catch {
    return {
      ok: false,
      reason: "Wallet signature verification failed.",
    };
  }

  const issuedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + sessionTtlMs).toISOString();
  const session: WebSession = {
    id: crypto.randomUUID(),
    identity: {
      address: payload.walletAddress,
      cluster: payload.network,
      custody: payload.custody,
    },
    issuedAt,
    expiresAt,
    ...(input.deviceId ? { deviceId: input.deviceId } : {}),
  };

  return {
    ok: true,
    session,
  };
}

export async function createSessionToken(session: WebSession, secret: string): Promise<string> {
  const payload = sessionPayloadSchema.parse({
    type: "offpay-web-session",
    ...session,
  } satisfies SessionPayload);

  return signPayload(payload, secret);
}

export async function readSessionToken(
  token: string,
  secret: string,
  now = new Date(),
): Promise<WebSession | null> {
  const rawPayload = await verifyPayload(token, secret);
  const parsedPayload = sessionPayloadSchema.safeParse(rawPayload);

  if (!parsedPayload.success) {
    return null;
  }

  const payload = parsedPayload.data;

  if (new Date(payload.expiresAt).getTime() <= now.getTime()) {
    return null;
  }

  return {
    id: payload.id,
    identity: {
      address: payload.identity.address,
      cluster: payload.identity.cluster,
      custody: payload.identity.custody,
      ...(payload.identity.privyUserId ? { privyUserId: payload.identity.privyUserId } : {}),
    },
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
    ...(payload.deviceId ? { deviceId: payload.deviceId } : {}),
  };
}
