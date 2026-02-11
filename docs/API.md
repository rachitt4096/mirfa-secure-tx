# API

Base URL: `http://localhost:3001`

## Auth and Limits

- Optional API key header: `x-api-key` (required only when `API_KEY` is configured on server).
- Rate limit applies per IP + route bucket (except `/health`).
- Common security headers are returned on all responses.

## POST `/tx/encrypt`

Encrypt and store a transaction payload.

Request:

```json
{
  "partyId": "party_123",
  "payload": {
    "amount": 100,
    "currency": "AED"
  }
}
```

Response:

```json
{
  "success": true,
  "id": "tx_...",
  "record": {
    "id": "tx_...",
    "partyId": "party_123",
    "createdAt": "2026-02-10T00:00:00.000Z",
    "payload_nonce": "...",
    "payload_ct": "...",
    "payload_tag": "...",
    "dek_wrap_nonce": "...",
    "dek_wrapped": "...",
    "dek_wrap_tag": "...",
    "alg": "AES-256-GCM",
    "mk_version": 1
  }
}
```

Notes:
- `partyId` must match `^[a-zA-Z0-9_-]{3,64}$`.
- `payload` must be a JSON object.
- Max payload size is `64KB`.

## GET `/tx/:id`

Fetch encrypted transaction record by ID.

Response:

```json
{
  "success": true,
  "record": {}
}
```

`id` must match `^tx_[a-f0-9]{32}$`.

## POST `/tx/:id/decrypt`

Decrypt stored transaction payload.

Response:

```json
{
  "success": true,
  "payload": {
    "amount": 100,
    "currency": "AED"
  }
}
```

## GET `/tx`

List all stored records.

Optional query:
- `partyId`: filter records by party id.

## GET `/health`

Health check response:

```json
{
  "status": "ok",
  "timestamp": "2026-02-11T10:00:00.000Z",
  "transactions": 12,
  "uptimeSeconds": 438,
  "version": "1.0.0"
}
```

## Error Shape

```json
{
  "error": "ValidationError",
  "message": "description of what failed",
  "requestId": "req-..."
}
```

Possible status codes:
- `400`: validation errors (schema/crypto fields)
- `401`: missing or invalid `x-api-key`
- `404`: unknown tx id / route
- `413`: request body too large
- `429`: rate limit exceeded (`Retry-After` response header set)
- `500`: internal server error
