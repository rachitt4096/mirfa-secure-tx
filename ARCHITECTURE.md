# Architecture

## Components

- `apps/web`: Next.js UI that triggers encrypt, fetch, and decrypt flows.
- `apps/api`: Fastify API that performs encryption/decryption and stores secure records.
- `packages/crypto`: Shared envelope encryption library used by API.

## Data Flow

1. Client posts `{ partyId, payload }` to `POST /tx/encrypt`.
2. API validates request shape, payload size, and identifier formats.
3. API generates random DEK and encrypts payload with AES-256-GCM.
4. API wraps DEK with master key (AES-256-GCM).
5. API binds both operations to derived AAD: `id + partyId + mk_version`.
6. API stores resulting `TxSecureRecord` in in-memory storage.
7. Client fetches encrypted record via `GET /tx/:id`.
8. Client requests decrypt via `POST /tx/:id/decrypt`; API unwraps DEK and decrypts payload.

## Trust Boundaries

- Master key is server-only (`MASTER_KEY`) and never exposed to clients.
- Browser receives encrypted records and decrypted payload output only.
- Crypto implementation is isolated in a reusable package.
- Request IDs are returned in errors for traceability across logs.

## Operational Guardrails

- Bounded payload size (`64KB`) for encrypt endpoint.
- Schema validation at API layer + hex/length validation at crypto layer.
- Record cloning in storage to avoid accidental mutation.
- Optional API-key gate (`x-api-key`) for `/tx*` routes.
- In-memory rate limiting with configurable window and request cap.
- `/health` reports uptime/version/transaction count for observability.

## Production Scaling Path

- Replace in-memory store with PostgreSQL/Redis.
- Add authentication, rate-limiting, and audit logging.
- Introduce master key versioning and DEK re-wrap workflow for key rotation.
