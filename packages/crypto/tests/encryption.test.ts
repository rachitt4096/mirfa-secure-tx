import { randomBytes } from "node:crypto";
import { describe, expect, it, beforeEach } from "vitest";
import { EncryptionService, ValidationError } from "../src/index.js";

describe("EncryptionService - Core Functionality", () => {
  let service: EncryptionService;
  const masterKey = randomBytes(32).toString("hex");

  beforeEach(() => {
    service = new EncryptionService(masterKey);
  });

  it("should encrypt and decrypt payload correctly", () => {
    const payload = { amount: 100, currency: "AED", metadata: { user: "test" } };
    const partyId = "party_123";

    const { record } = service.encryptPayload(partyId, payload);

    expect(record.id).toMatch(/^tx_[0-9a-f]{32}$/);
    expect(record.partyId).toBe(partyId);
    expect(record.alg).toBe("AES-256-GCM");
    expect(record.mk_version).toBe(1);

    const decrypted = service.decryptPayload(record);

    expect(decrypted).toEqual(payload);
  });

  it("should generate unique DEKs for each encryption", () => {
    const payload = { test: "data" };

    const result1 = service.encryptPayload("party_1", payload);
    const result2 = service.encryptPayload("party_1", payload);

    expect(result1.record.payload_ct).not.toBe(result2.record.payload_ct);
    expect(result1.record.dek_wrapped).not.toBe(result2.record.dek_wrapped);
  });
});

describe("EncryptionService - Tampering Detection", () => {
  let service: EncryptionService;
  const masterKey = randomBytes(32).toString("hex");

  beforeEach(() => {
    service = new EncryptionService(masterKey);
  });

  it("should fail with tampered ciphertext", () => {
    const payload = { amount: 100, currency: "AED" };
    const { record } = service.encryptPayload("party_123", payload);

    const tamperedCt = record.payload_ct.slice(0, -4) + "ffff";

    expect(() => {
      service.decryptPayload({
        ...record,
        payload_ct: tamperedCt,
      });
    }).toThrow(ValidationError);
  });

  it("should fail with tampered authentication tag", () => {
    const payload = { amount: 100, currency: "AED" };
    const { record } = service.encryptPayload("party_123", payload);

    const tamperedTag = record.payload_tag.slice(0, -4) + "ffff";

    expect(() => {
      service.decryptPayload({
        ...record,
        payload_tag: tamperedTag,
      });
    }).toThrow("Decryption failed");
  });

  it("should fail with tampered wrapped DEK", () => {
    const payload = { amount: 100, currency: "AED" };
    const { record } = service.encryptPayload("party_123", payload);

    const tamperedDek = record.dek_wrapped.slice(0, -4) + "ffff";

    expect(() => {
      service.decryptPayload({
        ...record,
        dek_wrapped: tamperedDek,
      });
    }).toThrow(ValidationError);
  });
});
