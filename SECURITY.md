# Security

## Cryptographic Design

- Algorithm: `AES-256-GCM`.
- Payload is encrypted with a random 256-bit DEK.
- DEK is encrypted (wrapped) with a 256-bit master key.
- Nonce size: 12 bytes (96 bits, NIST-recommended for GCM).
- Auth tag size: 16 bytes (128 bits).
- Record metadata includes `mk_version` for future key rotation workflows.

## Integrity and Tamper Detection

- GCM authentication tags are verified during decryption.
- Any modification in ciphertext, nonce, or tag causes decryption failure.
- Wrapped DEK tampering also fails tag validation before payload decrypt.
- Associated data (AAD) binds ciphertext to record identity:
  - `id`
  - `partyId`
  - `mk_version`
- Metadata tampering (for example changing `partyId`) causes decrypt failure.

## Input Validation

- Hex fields must be non-empty, even-length, and valid hex.
- Nonce/tag lengths are checked against constants.
- Master key length must be exactly 32 bytes (64 hex chars).
- Unwrapped DEK length must be exactly 32 bytes.
- Unsupported `mk_version` values are rejected.

## Operational Recommendations

- Store `MASTER_KEY` in a secret manager/KMS in production.
- Rotate keys with `mk_version` and DEK re-wrap strategy.
- Restrict CORS origins and add endpoint-level rate limiting.
- Record security-relevant events in tamper-evident logs.
