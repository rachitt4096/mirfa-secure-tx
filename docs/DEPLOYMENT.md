# Deployment

## Prerequisites

- Node.js 20+
- Corepack enabled (`corepack enable`) or pnpm 9+ (`npm i -g pnpm`)
- Vercel account for deployment

## Build Commands

```bash
corepack pnpm install
corepack pnpm build
```

## Environment Variables

### API (`apps/api`)

- `PORT` (default `3001`)
- `HOST` (default `0.0.0.0`)
- `MASTER_KEY` (required, 64-char hex string)
- `NODE_ENV` (`development` or `production`)
- `CORS_ORIGIN` (comma-separated allowed origins, default `*`)
- `LOG_LEVEL` (default `info`)
- `API_KEY` (optional; if set, callers must send `x-api-key`)
- `RATE_LIMIT_WINDOW_MS` (default `60000`)
- `RATE_LIMIT_MAX` (default `120`)

Note: local development can auto-generate an ephemeral master key when `NODE_ENV=development`.
Production must always set an explicit `MASTER_KEY`.
If `API_KEY` is enabled, clients must send the header explicitly (the demo web app does not inject it).

### Web (`apps/web`)

- `NEXT_PUBLIC_API_URL` (example: `https://your-api.vercel.app`)
- `DEV_LAN_ORIGIN` (optional, fixes local LAN dev origin warning for Next)

## Local Run

Start both apps:

```bash
corepack pnpm dev
```

If you run individually:

```bash
corepack pnpm --filter @mirfa/api run dev
corepack pnpm --filter web run dev
```

## Deploy API (Vercel)

1. Set project root to `apps/api`.
2. Build command: `corepack pnpm build`.
3. Add `MASTER_KEY` secret (required).
4. Add `API_KEY` (optional).
5. Deploy and verify `GET /health`.

## Deploy Web (Vercel)

1. Set project root to `apps/web`.
2. Add `NEXT_PUBLIC_API_URL` pointing to deployed API.
3. Deploy and run encrypt/fetch/decrypt smoke tests from UI.

## Post-Deploy Smoke Checks

1. `GET /health` returns `status: ok`.
2. `POST /tx/encrypt` returns `201` with a `tx_...` id.
3. `GET /tx/:id` returns the encrypted record.
4. `POST /tx/:id/decrypt` returns the original payload.
