import { describe, expect, it } from "vitest";

import app from "../../../workers/web-gateway/src/index";
import {
  isAllowedOrigin,
  isLocalDevelopmentOrigin,
  normalizeOrigin,
  parseAllowedOrigins,
} from "../../../workers/web-gateway/src/cors";

describe("gateway CORS helpers", () => {
  it("normalizes origin entries before comparison", () => {
    expect(normalizeOrigin(" http://localhost:3000/ ")).toBe("http://localhost:3000");
    expect(normalizeOrigin("https://app.example.invalid/some/path")).toBe(
      "https://app.example.invalid",
    );
  });

  it("ignores invalid or unsupported origins", () => {
    expect(normalizeOrigin("not an origin")).toBeUndefined();
    expect(normalizeOrigin("javascript:alert(1)")).toBeUndefined();
  });

  it("supports comma-separated allowed web origins", () => {
    const allowedOrigins = parseAllowedOrigins({
      OFFPAY_ALLOWED_WEB_ORIGINS:
        "http://localhost:3000/, https://app.example.invalid/path, not an origin",
    });

    expect(Array.from(allowedOrigins)).toEqual([
      "http://localhost:3000",
      "https://app.example.invalid",
    ]);
  });

  it("allows localhost development origins by default", () => {
    expect(isLocalDevelopmentOrigin({}, "http://localhost:3000")).toBe(true);
    expect(isLocalDevelopmentOrigin({}, "http://127.0.0.1:3000")).toBe(true);
    expect(isLocalDevelopmentOrigin({}, "https://localhost:3000")).toBe(false);
    expect(
      isLocalDevelopmentOrigin(
        { OFFPAY_ALLOW_LOCALHOST_ORIGINS: "false" },
        "http://localhost:3000",
      ),
    ).toBe(false);
  });

  it("allows localhost without replacing configured production origins", () => {
    expect(
      isAllowedOrigin(
        { OFFPAY_ALLOWED_WEB_ORIGINS: "https://app.example.invalid" },
        "http://localhost:3000",
      ),
    ).toBe(true);
    expect(
      isAllowedOrigin(
        {
          OFFPAY_ALLOWED_WEB_ORIGINS: "https://app.example.invalid",
          OFFPAY_ALLOW_LOCALHOST_ORIGINS: "false",
        },
        "http://localhost:3000",
      ),
    ).toBe(false);
  });

  it("allows Solana SDK headers on gateway RPC preflights", async () => {
    const response = await app.fetch(
      new Request("https://gateway.example.invalid/web/rpc/devnet", {
        headers: {
          "access-control-request-headers": "solana-client,content-type",
          "access-control-request-method": "POST",
          origin: "http://localhost:3000",
        },
        method: "OPTIONS",
      }),
      {},
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3000",
    );
    expect(response.headers.get("access-control-allow-headers")).toContain(
      "solana-client",
    );
  });
});
