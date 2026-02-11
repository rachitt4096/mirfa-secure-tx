import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { EncryptionService } from "../src/index.js";

describe("EncryptionService - Validation", () => {
  let service: EncryptionService;
  const masterKey = randomBytes(32).toString("hex");

  beforeEach(() => {
    service = new EncryptionService(masterKey);
  });

  it("should reject nonce with wrong length", () => {
    const payload = { amount: 100 };
    const { record } = service.encryptPayload("party_123", payload);

    expect(() => {
      service.decryptPayload({
        ...record,
        payload_nonce: "aabbccdd",
      });
    }).toThrow("must be 12 bytes");
  });

  it("should reject tag with wrong length", () => {
    const payload = { amount: 100 };
    const { record } = service.encryptPayload("party_123", payload);

    expect(() => {
      service.decryptPayload({
        ...record,
        payload_tag: "aabbccdd",
      });
    }).toThrow("must be 16 bytes");
  });

  it("should reject invalid hex characters", () => {
    const payload = { amount: 100 };
    const { record } = service.encryptPayload("party_123", payload);

    expect(() => {
      service.decryptPayload({
        ...record,
        payload_ct: "ZZZZZZZZ",
      });
    }).toThrow("must be an even-length hex string");
  });

  it("should reject invalid master key length", () => {
    expect(() => {
      new EncryptionService("aa");
    }).toThrow("Master key must be 32 bytes");
  });

  it("should reject unsupported master key version", () => {
    const payload = { amount: 200 };
    const { record } = service.encryptPayload("party_123", payload);

    expect(() => {
      service.decryptPayload({
        ...record,
        mk_version: 2,
      });
    }).toThrow("Unsupported mk_version");
  });
});
