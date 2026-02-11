import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ApiEncryptionService } from "../src/services/encryption.service.js";

describe("ApiEncryptionService", () => {
  const masterKey = randomBytes(32).toString("hex");

  it("encrypts and decrypts a payload", () => {
    const service = new ApiEncryptionService(masterKey);

    const record = service.encryptPayload("party_1", {
      amount: 150,
      currency: "AED",
    });

    const payload = service.decryptRecord(record);

    expect(payload).toEqual({ amount: 150, currency: "AED" });
  });

  it("fails decrypt when record metadata is tampered", () => {
    const service = new ApiEncryptionService(masterKey);

    const record = service.encryptPayload("party_1", {
      amount: 150,
      currency: "AED",
    });

    expect(() =>
      service.decryptRecord({
        ...record,
        partyId: "party_2",
      }),
    ).toThrow();
  });
});
