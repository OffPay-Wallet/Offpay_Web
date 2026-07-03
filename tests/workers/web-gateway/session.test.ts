import { describe, expect, it } from "vitest";

import type { WebSession } from "../../../src/lib/offpay/types";
import {
  createChallenge,
  createSessionToken,
  readSessionToken,
} from "../../../workers/web-gateway/src/session";

const secret = "test-session-secret-with-at-least-thirty-two-bytes";

describe("gateway session helpers", () => {
  it("creates a bounded login challenge", async () => {
    const challenge = await createChallenge({
      walletAddress: "11111111111111111111111111111111",
      network: "solana:devnet",
      custody: "external-solana",
      secret,
      now: new Date("2026-07-02T00:00:00.000Z"),
    });

    expect(challenge.challengeToken).toContain(".");
    expect(challenge.message).toContain("Sign in to Offpay Web");
    expect(challenge.message).toContain("Network: solana:devnet");
    expect(challenge.message).toContain("Custody: external-solana");
    expect(challenge.expiresAt).toBe("2026-07-02T00:05:00.000Z");
  });

  it("round-trips a signed session token", async () => {
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
    const token = await createSessionToken(session, secret);
    const parsed = await readSessionToken(token, secret, new Date("2026-07-03T00:00:00.000Z"));

    expect(parsed).toEqual(session);
  });
});
