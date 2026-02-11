import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { CRYPTO_CONSTANTS } from "./constants.js";
import {
  validateNonce,
  validateTag,
  validateHex,
  validateMasterKeyHex,
  hexToBuffer,
  bufferToHex,
  ValidationError,
} from "./validation.js";
import type { TxSecureRecord, EncryptionResult, DecryptionInput } from "./types.js";

export class EncryptionService {
  private masterKey: Buffer;

  constructor(masterKeyHex: string) {
    validateMasterKeyHex(masterKeyHex);
    this.masterKey = hexToBuffer(masterKeyHex);
  }

  private buildAad(record: Pick<TxSecureRecord, "id" | "partyId" | "mk_version">): Buffer {
    return Buffer.from(
      `${record.id}:${record.partyId}:v${record.mk_version}`,
      "utf-8",
    );
  }

  private encryptWithKey(
    plaintext: Buffer,
    key: Buffer,
    aad?: Buffer,
  ): { ciphertext: Buffer; nonce: Buffer; tag: Buffer } {
    const nonce = randomBytes(CRYPTO_CONSTANTS.NONCE_LENGTH);
    const cipher = createCipheriv(CRYPTO_CONSTANTS.ALGORITHM, key, nonce);

    if (aad) {
      cipher.setAAD(aad);
    }

    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();

    return { ciphertext, nonce, tag };
  }

  private decryptWithKey(
    ciphertext: Buffer,
    key: Buffer,
    nonce: Buffer,
    tag: Buffer,
    aad?: Buffer,
  ): Buffer {
    const decipher = createDecipheriv(CRYPTO_CONSTANTS.ALGORITHM, key, nonce);

    if (aad) {
      decipher.setAAD(aad);
    }

    decipher.setAuthTag(tag);

    try {
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } catch {
      throw new ValidationError(
        "Decryption failed: data may be tampered or corrupted",
      );
    }
  }

  public encryptPayload(
    partyId: string,
    payload: Record<string, unknown>,
  ): EncryptionResult {
    if (!partyId || partyId.trim().length === 0) {
      throw new ValidationError("partyId must be a non-empty string");
    }

    const recordId =
      `${CRYPTO_CONSTANTS.RECORD_ID_PREFIX}${randomBytes(16).toString("hex")}`;
    const mkVersion = CRYPTO_CONSTANTS.MK_VERSION;
    const aad = this.buildAad({
      id: recordId,
      partyId,
      mk_version: mkVersion,
    });

    const dek = randomBytes(CRYPTO_CONSTANTS.DEK_LENGTH);

    const payloadBuffer = Buffer.from(JSON.stringify(payload), "utf-8");
    const {
      ciphertext: payloadCt,
      nonce: payloadNonce,
      tag: payloadTag,
    } = this.encryptWithKey(payloadBuffer, dek, aad);

    const {
      ciphertext: dekWrapped,
      nonce: dekWrapNonce,
      tag: dekWrapTag,
    } = this.encryptWithKey(dek, this.masterKey, aad);

    const record: TxSecureRecord = {
      id: recordId,
      partyId,
      createdAt: new Date().toISOString(),
      payload_nonce: bufferToHex(payloadNonce),
      payload_ct: bufferToHex(payloadCt),
      payload_tag: bufferToHex(payloadTag),
      dek_wrap_nonce: bufferToHex(dekWrapNonce),
      dek_wrapped: bufferToHex(dekWrapped),
      dek_wrap_tag: bufferToHex(dekWrapTag),
      alg: "AES-256-GCM",
      mk_version: mkVersion,
    };

    return { record, dek };
  }

  public decryptPayload(input: DecryptionInput): Record<string, unknown> {
    if (!input.id || !input.partyId) {
      throw new ValidationError("id and partyId are required for decryption");
    }

    if (input.mk_version !== CRYPTO_CONSTANTS.MK_VERSION) {
      throw new ValidationError(
        `Unsupported mk_version: ${input.mk_version}. Expected ${CRYPTO_CONSTANTS.MK_VERSION}`,
      );
    }

    validateNonce(input.payload_nonce, "payload_nonce");
    validateTag(input.payload_tag, "payload_tag");
    validateNonce(input.dek_wrap_nonce, "dek_wrap_nonce");
    validateTag(input.dek_wrap_tag, "dek_wrap_tag");
    validateHex(input.payload_ct, "payload_ct");
    validateHex(input.dek_wrapped, "dek_wrapped");

    const payloadNonce = hexToBuffer(input.payload_nonce);
    const payloadCt = hexToBuffer(input.payload_ct);
    const payloadTag = hexToBuffer(input.payload_tag);
    const dekWrapNonce = hexToBuffer(input.dek_wrap_nonce);
    const dekWrapped = hexToBuffer(input.dek_wrapped);
    const dekWrapTag = hexToBuffer(input.dek_wrap_tag);
    const aad = this.buildAad({
      id: input.id,
      partyId: input.partyId,
      mk_version: input.mk_version,
    });

    let dek: Buffer | undefined;
    try {
      dek = this.decryptWithKey(
        dekWrapped,
        this.masterKey,
        dekWrapNonce,
        dekWrapTag,
        aad,
      );

      if (dek.length !== CRYPTO_CONSTANTS.DEK_LENGTH) {
        throw new ValidationError("Invalid unwrapped DEK length");
      }

      const payloadBuffer = this.decryptWithKey(
        payloadCt,
        dek,
        payloadNonce,
        payloadTag,
        aad,
      );

      let parsed: unknown;
      try {
        parsed = JSON.parse(payloadBuffer.toString("utf-8"));
      } catch {
        throw new ValidationError("Invalid JSON in decrypted payload");
      }

      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new ValidationError("Decrypted payload must be a JSON object");
      }

      return parsed as Record<string, unknown>;
    } finally {
      if (dek) {
        dek.fill(0);
      }
    }
  }
}
