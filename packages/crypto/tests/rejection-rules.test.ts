import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { EncryptionService, ValidationError } from "../src/index.js";

function tamperHex(hex: string): string {
  const last = hex.slice(-1);
  const flipped = last === "0" ? "1" : "0";
  return `${hex.slice(0, -1)}${flipped}`;
}

describe("EncryptionService - Required rejection rules", () => {
  let service: EncryptionService;
  const masterKey = randomBytes(32).toString("hex");

  beforeEach(() => {
    service = new EncryptionService(masterKey);
  });

  it("rejects when nonce is not 12 bytes", () => {
    const { record } = service.encryptPayload("party_123", { amount: 100 });

    expect(() => {
      service.decryptPayload({
        ...record,
        payload_nonce: "aabbccdd",
      });
    }).toThrow("must be 12 bytes");
  });

  it("rejects when tag is not 16 bytes", () => {
    const { record } = service.encryptPayload("party_123", { amount: 100 });

    expect(() => {
      service.decryptPayload({
        ...record,
        payload_tag: "aabbccdd",
      });
    }).toThrow("must be 16 bytes");
  });

  it("rejects invalid hex values", () => {
    const { record } = service.encryptPayload("party_123", { amount: 100 });

    expect(() => {
      service.decryptPayload({
        ...record,
        payload_ct: "zzzz",
      });
    }).toThrow("must be an even-length hex string");
  });

  it("rejects tampered ciphertext", () => {
    const { record } = service.encryptPayload("party_123", { amount: 100 });

    expect(() => {
      service.decryptPayload({
        ...record,
        payload_ct: tamperHex(record.payload_ct),
      });
    }).toThrow(ValidationError);
  });

  it("rejects tampered tag", () => {
    const { record } = service.encryptPayload("party_123", { amount: 100 });

    expect(() => {
      service.decryptPayload({
        ...record,
        payload_tag: tamperHex(record.payload_tag),
      });
    }).toThrow(ValidationError);
  });
});
