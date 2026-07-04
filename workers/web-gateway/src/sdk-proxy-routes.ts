import type { Context, Hono } from "hono";
import { z } from "zod";

import { fail } from "./envelope";
import { gatewayDebugLog, gatewayWarnLog } from "./observability";
import { proxySolanaRpc, RpcProxyError } from "./rpc-proxy";
import type { GatewayBindings } from "./types";
import { proxyUmbraApi, UmbraApiProxyError } from "./umbra-api-proxy";

const rawProxyNetworkSchema = z.enum(["devnet", "mainnet"]);

function rpcProxyErrorResponse(error: RpcProxyError, status: number): Response {
  return Response.json(
    {
      error: {
        code: -32000,
        message: error.message,
      },
      id: null,
      jsonrpc: "2.0",
    },
    { status },
  );
}

function rpcProxyUnknownErrorResponse(): Response {
  return Response.json(
    {
      error: {
        code: -32000,
        message: "Solana RPC proxy is unavailable.",
      },
      id: null,
      jsonrpc: "2.0",
    },
    { status: 502 },
  );
}

function rpcProxyUnsupportedNetworkResponse(): Response {
  return Response.json(
    {
      error: {
        code: -32602,
        message: "Unsupported Solana RPC proxy network.",
      },
      id: null,
      jsonrpc: "2.0",
    },
    { status: 400 },
  );
}

function handleUmbraProxyError(c: Context<GatewayBindings>, error: unknown): Response {
  if (error instanceof UmbraApiProxyError) {
    gatewayWarnLog(c, "umbra.proxy.error", {
      code: error.code,
      details: error.details,
      status: error.status,
    });

    return fail(c, error.status, {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
  }

  gatewayWarnLog(c, "umbra.proxy.unknown_error");
  return fail(c, 502, {
    code: "umbra_proxy_unavailable",
    message: "Umbra proxy is unavailable.",
  });
}

export function registerSdkProxyRoutes(app: Hono<GatewayBindings>) {
  app.post("/web/rpc/:network", async (c) => {
    const parsedNetwork = rawProxyNetworkSchema.safeParse(c.req.param("network"));

    if (!parsedNetwork.success) {
      return rpcProxyUnsupportedNetworkResponse();
    }

    try {
      const response = await proxySolanaRpc({
        env: c.env,
        network: parsedNetwork.data,
        request: c.req.raw,
      });

      gatewayDebugLog(c, "rpc.proxy.success", {
        network: parsedNetwork.data,
        status: response.status,
      });
      return response;
    } catch (error) {
      if (error instanceof RpcProxyError) {
        gatewayWarnLog(c, "rpc.proxy.error", {
          code: error.code,
          network: parsedNetwork.data,
          status: error.status,
        });
        return rpcProxyErrorResponse(error, error.status);
      }

      gatewayWarnLog(c, "rpc.proxy.unknown_error", { network: parsedNetwork.data });
      return rpcProxyUnknownErrorResponse();
    }
  });

  app.all("/web/umbra/indexer/:network/:proxyPath{.+}", async (c) => {
    const parsedNetwork = rawProxyNetworkSchema.safeParse(c.req.param("network"));
    const accept = c.req.header("accept");
    const responseLayout = c.req.header("x-response-layout");

    if (!parsedNetwork.success) {
      return fail(c, 400, {
        code: "umbra_proxy_network_unsupported",
        message: "Unsupported Umbra indexer proxy network.",
      });
    }

    try {
      const response = await proxyUmbraApi({
        env: c.env,
        network: parsedNetwork.data,
        path: c.req.param("proxyPath") ?? "",
        requestHeaders: {
          ...(accept ? { accept } : {}),
          ...(responseLayout ? { responseLayout } : {}),
        },
        request: c.req.raw,
        service: "indexer",
      });

      gatewayDebugLog(c, "umbra.indexer_proxy.success", {
        network: parsedNetwork.data,
        status: response.status,
      });
      return response;
    } catch (error) {
      return handleUmbraProxyError(c, error);
    }
  });

  app.all("/web/umbra/relayer/:network/:proxyPath{.+}", async (c) => {
    const parsedNetwork = rawProxyNetworkSchema.safeParse(c.req.param("network"));
    const accept = c.req.header("accept");

    if (!parsedNetwork.success) {
      return fail(c, 400, {
        code: "umbra_proxy_network_unsupported",
        message: "Unsupported Umbra relayer proxy network.",
      });
    }

    try {
      const response = await proxyUmbraApi({
        env: c.env,
        network: parsedNetwork.data,
        path: c.req.param("proxyPath") ?? "",
        requestHeaders: {
          ...(accept ? { accept } : {}),
        },
        request: c.req.raw,
        service: "relayer",
      });

      gatewayDebugLog(c, "umbra.relayer_proxy.success", {
        network: parsedNetwork.data,
        status: response.status,
      });
      return response;
    } catch (error) {
      return handleUmbraProxyError(c, error);
    }
  });
}
