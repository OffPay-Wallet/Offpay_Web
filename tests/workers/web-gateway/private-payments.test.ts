import { afterEach, describe, expect, it, vi } from "vitest";

import type { WebSession } from "../../../src/lib/offpay/types";
import app from "../../../workers/web-gateway/src/index";
import { createSessionToken } from "../../../workers/web-gateway/src/session";

const secret = "test-session-secret-with-at-least-thirty-two-bytes";
const session: WebSession = {
  id: "session_private_send_1234567890",
  identity: {
    address: "11111111111111111111111111111111",
    cluster: "solana:devnet",
    custody: "external-solana",
  },
  issuedAt: "2026-07-09T00:00:00.000Z",
  expiresAt: "2099-07-09T00:00:00.000Z",
};

async function authorizedRequest(path: string, body: object): Promise<Request> {
  const sessionToken = await createSessionToken(session, secret);

  return new Request(`https://gateway.example.invalid${path}`, {
    body: JSON.stringify(body),
    headers: {
      authorization: `Bearer ${sessionToken}`,
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    method: "POST",
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("gateway private payment route", () => {
  it("prepares MagicBlock private SPL transfers through the configured upstream origin", async () => {
    const fetchMock = vi.fn(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;

      expect(String(input)).toBe("https://magicblock.example.invalid/v1/spl/transfer");
      expect(init?.method).toBe("POST");
      expect(body).toMatchObject({
        amount: 123_456,
        cluster: "devnet-private",
        from: session.identity.address,
        fromBalance: "base",
        initAtasIfMissing: true,
        initIfMissing: true,
        initVaultIfMissing: true,
        memo: "invoice-123",
        mint: "4oG4sjmopf5MzvTHLE8rpVJ2uyczxfsw2K84SUTpNDx7",
        to: "22222222222222222222222222222222",
        toBalance: "base",
        visibility: "private",
      });

      return Response.json({
        instructionCount: 4,
        kind: "transfer",
        lastValidBlockHeight: 99,
        recentBlockhash: "blockhash",
        requiredSigners: [session.identity.address],
        sendRpcEndpoint: "https://rpc.magicblock.example.invalid",
        sendTo: "base",
        transactionBase64: "AQID",
        version: "v0",
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await app.fetch(
      await authorizedRequest("/web/payment/private-send", {
        action: "prepare",
        amountAtomic: "123456",
        memo: "invoice-123",
        mint: "4oG4sjmopf5MzvTHLE8rpVJ2uyczxfsw2K84SUTpNDx7",
        provider: "magicblock",
        recipient: "22222222222222222222222222222222",
      }),
      {
        MAGICBLOCK_PRIVATE_PAYMENTS_API_ORIGIN: "https://magicblock.example.invalid",
        OFFPAY_WEB_SESSION_SECRET: secret,
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        lastValidBlockHeight: 99,
        sendTo: "base",
        transactionBase64: "AQID",
      },
    });
  });

  it("submits signed MagicBlock transactions through the transaction send endpoint", async () => {
    const fetchMock = vi.fn(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;

      expect(String(input)).toBe("https://magicblock.example.invalid/v1/transaction/send");
      expect(body).toMatchObject({
        cluster: "devnet-private",
        confirm: true,
        lastValidBlockHeight: 99,
        maxRetries: 3,
        recentBlockhash: "blockhash",
        sendRpcEndpoint: "https://rpc.magicblock.example.invalid",
        sendTo: "base",
        skipPreflight: false,
        transactionBase64: "signed-transaction",
      });

      return Response.json({
        confirmationRequiresAuthToken: false,
        confirmationRpcEndpoint: "https://rpc.magicblock.example.invalid",
        confirmed: true,
        sendTo: "base",
        signature: "5J7mN2pW4Z9kV6qR8sT1uX3yA5cD7eF9gH2jK4mN6pQ8rS1tU3vW5xY7zA9bC1dE",
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await app.fetch(
      await authorizedRequest("/web/payment/private-send", {
        action: "submit",
        lastValidBlockHeight: 99,
        provider: "magicblock",
        recentBlockhash: "blockhash",
        sendRpcEndpoint: "https://rpc.magicblock.example.invalid",
        sendTo: "base",
        transactionBase64: "signed-transaction",
      }),
      {
        MAGICBLOCK_PRIVATE_PAYMENTS_API_ORIGIN: "https://magicblock.example.invalid",
        OFFPAY_WEB_SESSION_SECRET: secret,
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        confirmed: true,
        sendTo: "base",
      },
    });
  });

  it("fails closed when the MagicBlock upstream origin is not configured", async () => {
    const response = await app.fetch(
      await authorizedRequest("/web/payment/private-send", {
        action: "prepare",
        amountAtomic: "1",
        mint: "4oG4sjmopf5MzvTHLE8rpVJ2uyczxfsw2K84SUTpNDx7",
        provider: "magicblock",
        recipient: "22222222222222222222222222222222",
      }),
      {
        OFFPAY_WEB_SESSION_SECRET: secret,
      },
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: {
        code: "magicblock_api_missing",
      },
    });
  });
});
