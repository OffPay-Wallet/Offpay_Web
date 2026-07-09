import { afterEach, describe, expect, it, vi } from "vitest";

import type { WebSession } from "../../../src/lib/offpay/types";
import app from "../../../workers/web-gateway/src/index";
import { createSessionToken } from "../../../workers/web-gateway/src/session";

const secret = "test-session-secret-with-at-least-thirty-two-bytes";
const session: WebSession = {
  id: "session_1234567890",
  identity: {
    address: "11111111111111111111111111111111",
    cluster: "solana:devnet",
    custody: "external-solana",
  },
  issuedAt: "2026-07-02T00:00:00.000Z",
  expiresAt: "2099-07-09T00:00:00.000Z",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("gateway session status route", () => {
  it("reports a missing session without returning unauthorized", async () => {
    const response = await app.fetch(
      new Request("https://gateway.example.invalid/web/session/status", {
        headers: {
          origin: "http://localhost:3000",
        },
      }),
      {
        OFFPAY_WEB_SESSION_SECRET: secret,
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3000",
    );
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: null,
    });
  });

  it("accepts an in-memory bearer session token when browser cookies are unavailable", async () => {
    const sessionToken = await createSessionToken(session, secret);
    const response = await app.fetch(
      new Request("https://gateway.example.invalid/web/session/status", {
        headers: {
          authorization: `Bearer ${sessionToken}`,
          origin: "http://localhost:3000",
        },
      }),
      {
        OFFPAY_WEB_SESSION_SECRET: secret,
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: session,
    });
  });
});

describe("gateway public balance route", () => {
  it("fetches public balances from configured gateway RPC without a signed session", async () => {
    const fetchMock = vi.fn(
      async (_input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const body = JSON.parse(String(init?.body)) as { method?: string };

        if (body.method === "getBalance") {
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              id: "test",
              result: {
                value: 1_000_000_000,
              },
            }),
          );
        }

        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: "test",
            result: {
              value: [],
            },
          }),
        );
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await app.fetch(
      new Request(
        "https://gateway.example.invalid/web/public/balances?address=11111111111111111111111111111111&network=solana:devnet",
        {
          headers: {
            origin: "http://localhost:3000",
          },
        },
      ),
      {
        HELIUS_DEVNET_RPC_URL: "https://rpc.example.invalid",
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3000",
    );
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        address: "11111111111111111111111111111111",
        cluster: "solana:devnet",
        sol: {
          uiAmount: 1,
        },
      },
    });

    const [target, init] = fetchMock.mock.calls[0] ?? [];

    expect(target).toBe("https://rpc.example.invalid");
    expect(init?.method).toBe("POST");
  });

  it("reports missing RPC config without falling back to an upstream worker", async () => {
    const response = await app.fetch(
      new Request(
        "https://gateway.example.invalid/web/public/balances?address=11111111111111111111111111111111&network=solana:devnet",
        {
          headers: {
            origin: "http://localhost:3000",
          },
        },
      ),
      {},
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: {
        code: "rpc_config_missing",
      },
    });
  });
});

describe("gateway Umbra holdings route", () => {
  it("returns server-normalized encrypted holdings without a signed session", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        active_stealth_pool_indices: ["0"],
        address: "Relayer111111111111111111111111111111111",
        supported_mints: ["4oG4sjmopf5MzvTHLE8rpVJ2uyczxfsw2K84SUTpNDx7"],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await app.fetch(
      new Request(
        "https://gateway.example.invalid/web/umbra/holdings?address=11111111111111111111111111111111&network=solana:devnet",
        {
          headers: {
            origin: "http://localhost:3000",
          },
        },
      ),
      {
        UMBRA_RELAYER_URL_DEVNET: "https://relayer.devnet.example.invalid",
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        activeStealthPoolIndices: ["0"],
        holdings: [
          {
            balanceLabel: "Encrypted",
            depositEnabled: true,
            symbol: "dUSDC",
          },
        ],
        network: "devnet",
      },
    });
  });
});

describe("gateway SDK proxy routes", () => {
  it("passes allowlisted Solana JSON-RPC requests through configured worker RPC", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        id: "umbra-rpc",
        jsonrpc: "2.0",
        result: { context: { slot: 1 }, value: 2 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await app.fetch(
      new Request("https://gateway.example.invalid/web/rpc/devnet", {
        body: JSON.stringify({
          id: "umbra-rpc",
          jsonrpc: "2.0",
          method: "getBalance",
          params: ["11111111111111111111111111111111"],
        }),
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        method: "POST",
      }),
      {
        HELIUS_DEVNET_RPC_URL: "https://rpc.example.invalid",
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      jsonrpc: "2.0",
      result: { value: 2 },
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://rpc.example.invalid");
  });

  it("passes validated Solana JSON-RPC batch requests through configured worker RPC", async () => {
    const fetchMock = vi.fn(async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { id?: string; method?: string };

      expect(Array.isArray(body)).toBe(false);

      return Response.json({
        id: body.id,
        jsonrpc: "2.0",
        result:
          body.method === "sendTransaction"
            ? "signature"
            : { context: { slot: 1 }, value: body.method === "isBlockhashValid" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await app.fetch(
      new Request("https://gateway.example.invalid/web/rpc/devnet", {
        body: JSON.stringify([
          {
            id: "simulate",
            jsonrpc: "2.0",
            method: "simulateTransaction",
            params: ["abc", { encoding: "base64" }],
          },
          {
            id: "send",
            jsonrpc: "2.0",
            method: "sendTransaction",
            params: ["abc", { encoding: "base64" }],
          },
          {
            id: "fees",
            jsonrpc: "2.0",
            method: "getRecentPrioritizationFees",
            params: [],
          },
          {
            id: "blockhash",
            jsonrpc: "2.0",
            method: "isBlockhashValid",
            params: ["blockhash", { commitment: "confirmed" }],
          },
        ]),
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        method: "POST",
      }),
      {
        HELIUS_DEVNET_RPC_URL: "https://rpc.example.invalid",
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      expect.objectContaining({ id: "simulate" }),
      expect.objectContaining({ id: "send" }),
      expect.objectContaining({ id: "fees" }),
      expect.objectContaining({ id: "blockhash" }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    for (const [target, init] of fetchMock.mock.calls) {
      expect(target).toBe("https://rpc.example.invalid");
      expect(Array.isArray(JSON.parse(String(init?.body)))).toBe(false);
    }
  });

  it("blocks non-allowlisted Solana JSON-RPC methods", async () => {
    const response = await app.fetch(
      new Request("https://gateway.example.invalid/web/rpc/devnet", {
        body: JSON.stringify({
          id: "bad-rpc",
          jsonrpc: "2.0",
          method: "requestAirdrop",
          params: ["11111111111111111111111111111111", 1],
        }),
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        method: "POST",
      }),
      {
        HELIUS_DEVNET_RPC_URL: "https://rpc.example.invalid",
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: -32000,
      },
      jsonrpc: "2.0",
    });
  });

  it("passes Umbra relayer SDK requests through the configured relayer", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        address: "Relayer111111111111111111111111111111111",
        supported_mints: ["So11111111111111111111111111111111111111112"],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await app.fetch(
      new Request("https://gateway.example.invalid/web/umbra/relayer/devnet/v1/relayer/info", {
        headers: {
          origin: "http://localhost:3000",
        },
      }),
      {
        UMBRA_RELAYER_URL_DEVNET: "https://relayer.devnet.example.invalid",
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      address: "Relayer111111111111111111111111111111111",
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://relayer.devnet.example.invalid/v1/relayer/info",
    );
  });

  it("passes Umbra indexer SDK proof requests through the configured indexer", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        proofs: [],
        root: "root",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await app.fetch(
      new Request("https://gateway.example.invalid/web/umbra/indexer/devnet/v1/trees/1/proofs", {
        body: JSON.stringify({ insertion_indices: [1, 2] }),
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        method: "POST",
      }),
      {
        UMBRA_INDEXER_URL_DEVNET: "https://indexer.devnet.example.invalid",
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      proofs: [],
      root: "root",
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://indexer.devnet.example.invalid/v1/trees/1/proofs",
    );
  });

  it("requests the Umbra indexer columnar UTXO layout used by the SDK", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ columns: null, has_more: false, next_cursor: null, total_count: 0 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await app.fetch(
      new Request("https://gateway.example.invalid/web/umbra/indexer/devnet/v1/utxos", {
        headers: {
          origin: "http://localhost:3000",
        },
      }),
      {
        UMBRA_INDEXER_URL_DEVNET: "https://indexer.devnet.example.invalid",
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      has_more: false,
      total_count: 0,
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://indexer.devnet.example.invalid/v1/utxos");
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      "x-response-layout": "columnar",
    });
  });
});

describe("gateway manual workflow config route", () => {
  it("reports configured route and env groups without exposing values", async () => {
    const response = await app.fetch(
      new Request("https://gateway.example.invalid/web/config/status", {
        headers: {
          origin: "http://localhost:3000",
        },
      }),
      {
        HELIUS_DEVNET_RPC_URL: "https://rpc.example.invalid",
        OFFPAY_WEB_SESSION_SECRET: secret,
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        upstreamWorkersRemoved: true,
        routes: expect.arrayContaining([
          expect.objectContaining({
            method: "GET",
            path: "/web/wallet/balance",
            implemented: true,
          }),
          expect.objectContaining({
            method: "POST",
            path: "/web/umbra/claim",
            implemented: false,
          }),
          expect.objectContaining({
            method: "GET",
            path: "/web/umbra/holdings",
            implemented: true,
            public: true,
          }),
        ]),
      },
    });
  });
});
