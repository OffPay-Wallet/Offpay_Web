# Offpay Web

Greenfield Offpay web app built with Next.js App Router, strict TypeScript, Tailwind, Privy-secured Solana wallets, and a Cloudflare Web Gateway Worker.

## Local Commands

Do not start a local server for this repo unless the project instruction changes. Use static checks:

```bash
npm run typecheck
npm run worker:typecheck
npm run lint
npm run test
npm run build
npm run audit:prod
```

## Environment

Copy `.env.example` to `.env` and fill values there or in the deployment provider. Keep deploy-specific URLs and secrets out of source files.

Browser-safe keys:

```bash
NEXT_PUBLIC_PRIVY_APP_ID=
NEXT_PUBLIC_PRIVY_CLIENT_ID=
NEXT_PUBLIC_SOLANA_CLUSTER=
NEXT_PUBLIC_OFFPAY_GATEWAY_ORIGIN=
NEXT_PUBLIC_OFFPAY_DEBUG=
```

Worker-only keys:

```bash
OFFPAY_ALLOWED_WEB_ORIGINS=
OFFPAY_WEB_SESSION_SECRET=
OFFPAY_DEBUG_LOGS=
OFFPAY_ALLOW_LOCALHOST_ORIGINS=
OFFPAY_SOLANA_MAINNET_EXPLORER_TX_URL_TEMPLATE=
OFFPAY_SOLANA_DEVNET_EXPLORER_TX_URL_TEMPLATE=
OFFPAY_SOLANA_TESTNET_EXPLORER_TX_URL_TEMPLATE=
HELIUS_DEVNET_API_KEY=
HELIUS_MAINNET_API_KEY=
HELIUS_DEVNET_RPC_URL=
HELIUS_MAINNET_RPC_URL=
HELIUS_DEVNET_WS_URL=
HELIUS_MAINNET_WS_URL=
ALCHEMY_DEVNET_RPC_URL=
ALCHEMY_MAINNET_RPC_URL=
ALCHEMY_DEVNET_FALLBACK_RPC_URL=
ALCHEMY_MAINNET_FALLBACK_RPC_URL=
ALCHEMY_DEVNET_WS_URL=
ALCHEMY_MAINNET_WS_URL=
ALCHEMY_PRICE_API_KEY=
JUPITER_API_BASE_URL=
JUPITER_TRIGGER_API_BASE_URL=
JUPITER_API_KEY=
UMBRA_INDEXER_URL_DEVNET=
UMBRA_INDEXER_URL_MAINNET=
UMBRA_RELAYER_URL_DEVNET=
UMBRA_RELAYER_URL_MAINNET=
UMBRA_CIRCUIT_VERSION=
UMBRA_MIN_SDK_VERSION=
UMBRA_LOCAL_TEST_MODE=
MAGICBLOCK_DEVNET_VALIDATORS=
MAGICBLOCK_MAINNET_VALIDATORS=
OFFPAY_DEVNET_USDC_MINT=
OFFPAY_DEVNET_USDT_MINT=
OFFPAY_MAINNET_USDC_MINT=
OFFPAY_MAINNET_USDT_MINT=
```

## Wallet Model

The web app uses Privy for authentication and external Solana wallet connection. Embedded wallet creation is disabled in app config and guarded by a wallet-creation plugin; the dashboard ignores Privy embedded wallets if an existing user already has one linked.

## Gateway Worker

The Cloudflare Worker in `workers/web-gateway` owns browser-safe sessions, direct wallet balance RPC reads, and manual workflow route boundaries. Secret values belong in Cloudflare Worker secrets, not in browser-exposed env vars.

The gateway is configured through Cloudflare Worker bindings only. Do not commit Worker origins, RPC URLs, WebSocket URLs, service tokens, provider keys, or session secrets to source.

Set Worker env/secrets:

```bash
npx wrangler secret put OFFPAY_ALLOWED_WEB_ORIGINS --config workers/web-gateway/wrangler.toml
npx wrangler secret put OFFPAY_WEB_SESSION_SECRET --config workers/web-gateway/wrangler.toml
npx wrangler secret put OFFPAY_DEBUG_LOGS --config workers/web-gateway/wrangler.toml
npx wrangler secret put OFFPAY_ALLOW_LOCALHOST_ORIGINS --config workers/web-gateway/wrangler.toml
npx wrangler secret put OFFPAY_SOLANA_MAINNET_EXPLORER_TX_URL_TEMPLATE --config workers/web-gateway/wrangler.toml
npx wrangler secret put OFFPAY_SOLANA_DEVNET_EXPLORER_TX_URL_TEMPLATE --config workers/web-gateway/wrangler.toml
npx wrangler secret put OFFPAY_SOLANA_TESTNET_EXPLORER_TX_URL_TEMPLATE --config workers/web-gateway/wrangler.toml
npx wrangler secret put HELIUS_DEVNET_API_KEY --config workers/web-gateway/wrangler.toml
npx wrangler secret put HELIUS_MAINNET_API_KEY --config workers/web-gateway/wrangler.toml
npx wrangler secret put HELIUS_DEVNET_RPC_URL --config workers/web-gateway/wrangler.toml
npx wrangler secret put HELIUS_MAINNET_RPC_URL --config workers/web-gateway/wrangler.toml
npx wrangler secret put HELIUS_DEVNET_WS_URL --config workers/web-gateway/wrangler.toml
npx wrangler secret put HELIUS_MAINNET_WS_URL --config workers/web-gateway/wrangler.toml
npx wrangler secret put ALCHEMY_DEVNET_RPC_URL --config workers/web-gateway/wrangler.toml
npx wrangler secret put ALCHEMY_MAINNET_RPC_URL --config workers/web-gateway/wrangler.toml
npx wrangler secret put ALCHEMY_DEVNET_FALLBACK_RPC_URL --config workers/web-gateway/wrangler.toml
npx wrangler secret put ALCHEMY_MAINNET_FALLBACK_RPC_URL --config workers/web-gateway/wrangler.toml
npx wrangler secret put ALCHEMY_DEVNET_WS_URL --config workers/web-gateway/wrangler.toml
npx wrangler secret put ALCHEMY_MAINNET_WS_URL --config workers/web-gateway/wrangler.toml
npx wrangler secret put ALCHEMY_PRICE_API_KEY --config workers/web-gateway/wrangler.toml
npx wrangler secret put JUPITER_API_BASE_URL --config workers/web-gateway/wrangler.toml
npx wrangler secret put JUPITER_TRIGGER_API_BASE_URL --config workers/web-gateway/wrangler.toml
npx wrangler secret put JUPITER_API_KEY --config workers/web-gateway/wrangler.toml
npx wrangler secret put UMBRA_INDEXER_URL_DEVNET --config workers/web-gateway/wrangler.toml
npx wrangler secret put UMBRA_INDEXER_URL_MAINNET --config workers/web-gateway/wrangler.toml
npx wrangler secret put UMBRA_RELAYER_URL_DEVNET --config workers/web-gateway/wrangler.toml
npx wrangler secret put UMBRA_RELAYER_URL_MAINNET --config workers/web-gateway/wrangler.toml
npx wrangler secret put UMBRA_CIRCUIT_VERSION --config workers/web-gateway/wrangler.toml
npx wrangler secret put UMBRA_MIN_SDK_VERSION --config workers/web-gateway/wrangler.toml
npx wrangler secret put UMBRA_LOCAL_TEST_MODE --config workers/web-gateway/wrangler.toml
npx wrangler secret put MAGICBLOCK_DEVNET_VALIDATORS --config workers/web-gateway/wrangler.toml
npx wrangler secret put MAGICBLOCK_MAINNET_VALIDATORS --config workers/web-gateway/wrangler.toml
npx wrangler secret put OFFPAY_DEVNET_USDC_MINT --config workers/web-gateway/wrangler.toml
npx wrangler secret put OFFPAY_DEVNET_USDT_MINT --config workers/web-gateway/wrangler.toml
npx wrangler secret put OFFPAY_MAINNET_USDC_MINT --config workers/web-gateway/wrangler.toml
npx wrangler secret put OFFPAY_MAINNET_USDT_MINT --config workers/web-gateway/wrangler.toml
```

Wallet balances for `GET /web/public/balances`, `GET /web/balances`, and
`GET /web/wallet/balance` are read directly from configured gateway RPC
providers. The gateway no longer forwards these calls to upstream Workers.

`OFFPAY_ALLOWED_WEB_ORIGINS` must include every browser origin that calls the
gateway, separated by commas. If the web app is opened from local Next.js during
debugging, include `http://localhost:3000` alongside the deployed web origin.
Origin entries may include a trailing slash; the Worker normalizes them before
matching browser `Origin` headers.

Loopback HTTP origins such as `http://localhost:3000` are allowed by default for
local web debugging without replacing the production allow-list secret. Set
`OFFPAY_ALLOW_LOCALHOST_ORIGINS=false` on the Worker to disable that behavior.

Set `NEXT_PUBLIC_OFFPAY_DEBUG=1` to enable browser console diagnostics for
gateway API calls, query gating, and Web Vitals. Set `OFFPAY_DEBUG_LOGS=1` on the
Worker to emit matching request and RPC timing logs in Cloudflare.
Leave both unset outside active debugging.

Deploy and verify secret names:

```bash
npm run worker:deploy
npm run worker:secret:list
```

Wrangler can list secret names, but it cannot print secret values.
