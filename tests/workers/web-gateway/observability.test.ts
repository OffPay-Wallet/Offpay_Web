import { describe, expect, it } from "vitest";

import {
  appendServerTimingHeader,
  formatServerTimingMetric,
  isDebugLoggingEnabled,
  readClientRequestId,
  redactIdentifier,
} from "../../../workers/web-gateway/src/observability";

describe("gateway observability helpers", () => {
  it("keeps debug logging opt-in", () => {
    expect(isDebugLoggingEnabled({})).toBe(false);
    expect(isDebugLoggingEnabled({ OFFPAY_DEBUG_LOGS: "" })).toBe(false);
    expect(isDebugLoggingEnabled({ OFFPAY_DEBUG_LOGS: "false" })).toBe(false);
    expect(isDebugLoggingEnabled({ OFFPAY_DEBUG_LOGS: "1" })).toBe(true);
    expect(isDebugLoggingEnabled({ OFFPAY_DEBUG_LOGS: "verbose" })).toBe(true);
  });

  it("accepts only bounded client request ids", () => {
    expect(readClientRequestId("web_12345678")).toBe("web_12345678");
    expect(readClientRequestId("bad id with spaces")).toBeUndefined();
    expect(readClientRequestId("x".repeat(121))).toBeUndefined();
  });

  it("formats server timing metrics safely", () => {
    expect(formatServerTimingMetric("rpc getBalance", 12.34)).toBe(
      "rpc_getBalance;dur=12.3",
    );
  });

  it("appends server timing without dropping existing metrics", () => {
    const headers = new Headers({
      "server-timing": "upstream;dur=8.0",
    });

    appendServerTimingHeader(headers, "gateway", 5);

    expect(headers.get("server-timing")).toBe("upstream;dur=8.0, gateway;dur=5.0");
  });

  it("redacts long wallet-like identifiers", () => {
    expect(redactIdentifier("11111111111111111111111111111111")).toBe("1111...1111");
  });
});
