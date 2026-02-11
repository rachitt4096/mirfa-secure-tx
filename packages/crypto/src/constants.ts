export const CRYPTO_CONSTANTS = {
  ALGORITHM: "aes-256-gcm" as const,
  NONCE_LENGTH: 12,
  TAG_LENGTH: 16,
  DEK_LENGTH: 32,
  MASTER_KEY_LENGTH: 32,
  RECORD_ID_PREFIX: "tx_",
  MK_VERSION: 1 as const,
} as const;
