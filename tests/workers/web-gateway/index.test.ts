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
  expiresAt: "2026-07-09T00:00:00.000Z",
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
        ]),
      },
    });
  });
});
