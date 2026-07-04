import type { GatewayEnv } from "./types";

export type UmbraProxyNetwork = "devnet" | "mainnet";
type UmbraProxyService = "indexer" | "relayer";

const knownMethods = new Set(["GET", "POST"]);
const sensitiveKeyPattern =
  /private|secret|seed|mnemonic|master|viewing.?key|signature.?key|keypair/i;

export class UmbraApiProxyError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;
  readonly status: number;

  constructor({
    code,
    details,
    message,
    status,
  }: {
    code: string;
    details?: Record<string, unknown>;
    message: string;
    status: number;
  }) {
    super(message);
    this.name = "UmbraApiProxyError";
    this.code = code;
    this.status = status;

    if (details) {
      this.details = details;
    }
  }
}

function readIndexerUrl(env: GatewayEnv, network: UmbraProxyNetwork): string | null {
  const value =
    network === "devnet" ? env.UMBRA_INDEXER_URL_DEVNET : env.UMBRA_INDEXER_URL_MAINNET;
  return value?.trim() || null;
}

function readRelayerUrl(env: GatewayEnv, network: UmbraProxyNetwork): string | null {
  const value =
    network === "devnet" ? env.UMBRA_RELAYER_URL_DEVNET : env.UMBRA_RELAYER_URL_MAINNET;
  return value?.trim() || null;
}

function readBaseUrl(
  env: GatewayEnv,
  service: UmbraProxyService,
  network: UmbraProxyNetwork,
): string {
  const baseUrl =
    service === "indexer" ? readIndexerUrl(env, network) : readRelayerUrl(env, network);

  if (baseUrl) return baseUrl;

  throw new UmbraApiProxyError({
    code: `umbra_${service}_missing`,
    message: `Umbra ${service} is not configured on this Worker.`,
    status: 503,
  });
}

function normalizeProxyPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;

  return normalized.replace(/\/{2,}/g, "/");
}

function indexerPathAllowed(method: string, path: string): boolean {
  if (method === "GET" && path === "/health") return true;
  if (method === "GET" && /^\/health\/(?:detailed|liveness|readiness)$/.test(path)) {
    return true;
  }
  if (method === "GET" && path === "/v1/stats") return true;
  if (method === "GET" && path === "/v1/trees") return true;
  if (method === "GET" && /^\/v1\/trees\/\d+$/.test(path)) return true;
  if (method === "GET" && /^\/v1\/trees\/\d+\/utxos$/.test(path)) return true;
  if (method === "GET" && /^\/v1\/trees\/\d+\/proof\/\d+$/.test(path)) return true;
  if (method === "GET" && path === "/v1/utxos") return true;
  if (method === "GET" && /^\/v1\/utxos\/\d+$/.test(path)) return true;

  return method === "POST" && /^\/v1\/trees\/\d+\/proofs$/.test(path);
}

function relayerPathAllowed(method: string, path: string): boolean {
  if (method === "GET" && path === "/v1/relayer/info") return true;
  if (method === "POST" && path === "/v1/claims") return true;

  return method === "GET" && /^\/v1\/claims\/[A-Za-z0-9._:-]{1,160}$/.test(path);
}

function assertAllowedPath(service: UmbraProxyService, method: string, path: string) {
  const allowed =
    service === "indexer"
      ? indexerPathAllowed(method, path)
      : relayerPathAllowed(method, path);

  if (allowed) return;

  throw new UmbraApiProxyError({
    code: "umbra_proxy_path_not_allowed",
    details: { method, service, upstreamPath: path },
    message: "This Umbra upstream path is not allowed through the Web Gateway.",
    status: 404,
  });
}

function containsSensitiveKey(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((entry) => containsSensitiveKey(entry));
  }

  if (!value || typeof value !== "object") {
    return false;
  }

  return Object.entries(value).some(([key, entry]) => {
    return sensitiveKeyPattern.test(key) || containsSensitiveKey(entry);
  });
}

async function readSafePostBody(request: Request): Promise<string | undefined> {
  if (request.method !== "POST") return undefined;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new UmbraApiProxyError({
      code: "umbra_proxy_invalid_json",
      message: "Umbra proxy POST body must be JSON.",
      status: 400,
    });
  }

  if (containsSensitiveKey(body)) {
    throw new UmbraApiProxyError({
      code: "umbra_proxy_sensitive_payload",
      message: "Umbra proxy requests must not include private keys, seeds, or secrets.",
      status: 400,
    });
  }

  return JSON.stringify(body);
}

function copyQuery(sourceUrl: string, targetUrl: URL) {
  const source = new URL(sourceUrl);

  source.searchParams.forEach((value, key) => {
    targetUrl.searchParams.append(key, value);
  });
}

function responseHeaders(upstream: Response): Headers {
  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");

  headers.set("cache-control", "no-store");
  if (contentType) headers.set("content-type", contentType);

  return headers;
}

function defaultResponseLayout(
  service: UmbraProxyService,
  method: string,
  path: string,
): string | undefined {
  if (service === "indexer" && method === "GET" && path === "/v1/utxos") {
    return "columnar";
  }

  return undefined;
}

export async function proxyUmbraApi({
  env,
  network,
  path,
  requestHeaders,
  request,
  service,
}: {
  env: GatewayEnv;
  network: UmbraProxyNetwork;
  path: string;
  requestHeaders?: {
    accept?: string;
    responseLayout?: string;
  };
  request: Request;
  service: UmbraProxyService;
}): Promise<Response> {
  const method = request.method.toUpperCase();

  if (!knownMethods.has(method)) {
    throw new UmbraApiProxyError({
      code: "umbra_proxy_method_not_allowed",
      message: "This Umbra proxy method is not allowed.",
      status: 405,
    });
  }

  const upstreamPath = normalizeProxyPath(path);
  assertAllowedPath(service, method, upstreamPath);

  const upstreamUrl = new URL(upstreamPath, readBaseUrl(env, service, network));
  copyQuery(request.url, upstreamUrl);

  let upstream: Response;

  try {
    const accept = requestHeaders?.accept ?? request.headers.get("accept") ?? "application/json";
    const responseLayout =
      requestHeaders?.responseLayout ??
      request.headers.get("x-response-layout") ??
      defaultResponseLayout(service, method, upstreamPath);
    const body = await readSafePostBody(request);
    const headers: HeadersInit = {
      accept,
    };

    if (responseLayout) {
      headers["x-response-layout"] = responseLayout;
    }

    if (method === "POST") {
      headers["content-type"] = "application/json";
    }

    const init: RequestInit = { headers, method };
    if (body) {
      init.body = body;
    }

    upstream = await fetch(upstreamUrl.toString(), {
      ...init,
    });
  } catch {
    throw new UmbraApiProxyError({
      code: "umbra_proxy_network_error",
      details: { service, upstreamPath },
      message: `Unable to reach the configured Umbra ${service}.`,
      status: 502,
    });
  }

  return new Response(upstream.body, {
    headers: responseHeaders(upstream),
    status: upstream.status,
  });
}
