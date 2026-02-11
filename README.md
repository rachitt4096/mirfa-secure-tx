# Mirfa Secure Transactions

Production-grade mini system for secure transaction storage using envelope encryption.

## Why This Design

1. Envelope encryption keeps the master key out of data paths and enables key rotation by re-wrapping only DEKs.
2. AES-256-GCM gives confidentiality and integrity in one primitive.
3. AAD binds encrypted data to record metadata (`id + partyId + mk_version`) so cross-record tampering fails.

## Quick Start

```bash
# one-time: ensure pnpm binary is available in PATH
# (either `corepack enable` or `npm i -g pnpm`)
corepack pnpm install
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
corepack pnpm dev
```

If web shows `Network request failed`, API is not running or `NEXT_PUBLIC_API_URL` is wrong.
Verify API with:

```bash
curl http://localhost:3001/health
```

Developer ergonomics: in `NODE_ENV=development`, API auto-generates an ephemeral `MASTER_KEY`
if missing so local boot is still possible. Use an explicit `MASTER_KEY` for stable decrypt behavior.

## Monorepo Layout

```text
apps/
  api/      Fastify API
  web/      Next.js UI
packages/
  crypto/   Shared encryption core
docs/
  API.md
  DEPLOYMENT.md
ARCHITECTURE.md
SECURITY.md
```

## API Endpoints

- `POST /tx/encrypt`
- `GET /tx/:id`
- `POST /tx/:id/decrypt`
- `GET /tx` (supports `?partyId=...`)
- `GET /health`

## Senior-Level Guarantees

- Strong input validation (schema + crypto-level checks).
- Tamper detection for ciphertext, tags, and metadata-bound AAD.
- Defensive storage behavior via cloned records (mutation-safe in-memory cache).
- Structured API errors with `requestId` for traceability.
- Bounded payload size (`64KB`) to prevent abuse.
- Optional API key enforcement and route-level rate limiting.
- Health telemetry surfaced in UI for runtime diagnostics.

## Test Focus

- Round-trip correctness.
- Tampering failures (ciphertext/tag/metadata).
- Validation failures (nonce/tag length, invalid hex, unsupported key version).
- Integration flow coverage for encrypt/fetch/decrypt + API validation boundaries.
