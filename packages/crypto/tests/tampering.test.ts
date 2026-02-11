import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { EncryptionService } from "../src/index.js";

describe("EncryptionService - Edge Cases", () => {
  let service: EncryptionService;
  const masterKey = randomBytes(32).toString("hex");

  beforeEach(() => {
    service = new EncryptionService(masterKey);
  });

  it("should handle empty payload object", () => {
    const payload = {};
    const { record } = service.encryptPayload("party_123", payload);

    const decrypted = service.decryptPayload(record);
    expect(decrypted).toEqual(payload);
  });

  it("should handle complex nested payload", () => {
    const payload = {
      level1: {
        level2: {
          level3: {
            value: "deep",
            array: [1, 2, 3],
          },
        },
      },
      special: "chars unicode",
    };

    const { record } = service.encryptPayload("party_123", payload);
    const decrypted = service.decryptPayload(record);

    expect(decrypted).toEqual(payload);
  });

  it("should handle large payloads", () => {
    const largePayload = {
      data: "x".repeat(10000),
      array: Array(1000).fill({ test: "value" }),
    };

    const { record } = service.encryptPayload("party_123", largePayload);
    const decrypted = service.decryptPayload(record);

    expect(decrypted).toEqual(largePayload);
  });

  it("should fail when associated metadata is tampered", () => {
    const payload = { amount: 42 };
    const { record } = service.encryptPayload("party_123", payload);

    expect(() => {
      service.decryptPayload({
        ...record,
        partyId: "party_999",
      });
    }).toThrow("Decryption failed");
  });
});
