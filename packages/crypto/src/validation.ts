import { CRYPTO_CONSTANTS } from "./constants.js";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function validateHex(value: string, fieldName: string): void {
  if (!value || value.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(value)) {
    throw new ValidationError(
      `${fieldName} must be an even-length hex string (0-9, a-f, A-F)`,
    );
  }
}

export function validateHexLength(
  value: string,
  expectedBytes: number,
  fieldName: string,
): void {
  validateHex(value, fieldName);
  const actualBytes = value.length / 2;

  if (actualBytes !== expectedBytes) {
    throw new ValidationError(
      `${fieldName} must be ${expectedBytes} bytes (${expectedBytes * 2} hex chars), got ${actualBytes} bytes`,
    );
  }
}

export function validateNonce(nonce: string, fieldName: string): void {
  validateHexLength(nonce, CRYPTO_CONSTANTS.NONCE_LENGTH, fieldName);
}

export function validateTag(tag: string, fieldName: string): void {
  validateHexLength(tag, CRYPTO_CONSTANTS.TAG_LENGTH, fieldName);
}

export function validateMasterKeyHex(masterKeyHex: string): void {
  validateHex(masterKeyHex, "masterKeyHex");

  if (masterKeyHex.length !== CRYPTO_CONSTANTS.MASTER_KEY_LENGTH * 2) {
    throw new ValidationError(
      `Master key must be ${CRYPTO_CONSTANTS.MASTER_KEY_LENGTH} bytes (${CRYPTO_CONSTANTS.MASTER_KEY_LENGTH * 2} hex chars)`,
    );
  }
}

export function hexToBuffer(hex: string): Buffer {
  return Buffer.from(hex, "hex");
}

export function bufferToHex(buffer: Buffer): string {
  return buffer.toString("hex");
}
