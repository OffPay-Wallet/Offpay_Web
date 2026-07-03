<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project Instructions

- Do not run commands that start a local server.
- Do not start the Next.js app or Gateway Worker locally.
- Prefer static checks: typecheck, lint, tests, production build, and audit.
- Do not hardcode API origins, Worker origins, RPC URLs, WebSocket URLs, explorer URLs, service tokens, bootstrap secrets, session secrets, or provider keys in source, tests, docs, or Wrangler config.
- Browser-readable config must use `NEXT_PUBLIC_*` env vars and be accessed through `src/lib/offpay/public-config.ts`.
- Do not add browser RPC, WebSocket RPC, or explorer URL env vars unless a feature explicitly requires direct browser-chain access; Offpay Web should reuse the existing backend/worker RPC paths by default.
- Worker runtime config must be read from Cloudflare bindings in `workers/web-gateway/src/types.ts`; set values with Wrangler secrets or Cloudflare dashboard env vars, not `[vars]` literals in `wrangler.toml`.
- Keep `.env.example` exhaustive but value-empty for deploy-specific URLs/secrets. Keep real values only in `.env`, the hosting provider env settings, or Cloudflare Worker secrets.
- When adding a new endpoint or secret, add the key to `.env.example`, `.env` with an empty default if no value is known, the typed config accessor/binding, and deployment notes.

## Gateway Worker Deployment

Use repo-local Wrangler config:

```bash
npx wrangler secret put OFFPAY_ALLOWED_WEB_ORIGINS --config workers/web-gateway/wrangler.toml
npx wrangler secret put OFFPAY_WEB_SESSION_SECRET --config workers/web-gateway/wrangler.toml
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
npx wrangler secret put JUPITER_API_KEY --config workers/web-gateway/wrangler.toml
npm run worker:deploy
```

`npx wrangler secret list --config workers/web-gateway/wrangler.toml` verifies secret names only; it cannot reveal secret values.
