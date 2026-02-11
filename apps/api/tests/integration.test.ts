import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const MASTER_KEY = randomBytes(32).toString("hex");
process.env.NODE_ENV = "test";
process.env.MASTER_KEY = MASTER_KEY;

const { fastify } = await import("../src/index.js");

describe("API integration", () => {
  beforeAll(async () => {
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  it("encrypt -> fetch -> decrypt flow", async () => {
    const encryptResponse = await fastify.inject({
      method: "POST",
      url: "/tx/encrypt",
      payload: {
        partyId: "party_123",
        payload: { amount: 100, currency: "AED" },
      },
    });
    expect(encryptResponse.statusCode).toBe(201);

    const encryptJson = encryptResponse.json() as {
      success: boolean;
      id: string;
      record: { id: string };
    };
    expect(encryptJson.success).toBe(true);
    expect(encryptJson.id).toBe(encryptJson.record.id);

    const txId = encryptJson.id;

    const getResponse = await fastify.inject({
      method: "GET",
      url: `/tx/${txId}`,
    });
    expect(getResponse.statusCode).toBe(200);
    const getJson = getResponse.json() as { success: boolean; record: { id: string } };
    expect(getJson.success).toBe(true);
    expect(getJson.record.id).toBe(txId);

    const decryptResponse = await fastify.inject({
      method: "POST",
      url: `/tx/${txId}/decrypt`,
    });
    expect(decryptResponse.statusCode).toBe(200);

    const decryptJson = decryptResponse.json() as {
      success: boolean;
      payload: { amount: number; currency: string };
    };
    expect(decryptJson.success).toBe(true);
    expect(decryptJson.payload).toEqual({ amount: 100, currency: "AED" });
  });

  it("rejects invalid partyId", async () => {
    const response = await fastify.inject({
      method: "POST",
      url: "/tx/encrypt",
      payload: {
        partyId: "x",
        payload: { amount: 100 },
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it("rejects oversized payload", async () => {
    const response = await fastify.inject({
      method: "POST",
      url: "/tx/encrypt",
      payload: {
        partyId: "party_large",
        payload: { blob: "x".repeat(70_000) },
      },
    });

    expect(response.statusCode).toBe(413);
  });

  it("rejects malformed tx id on fetch", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/tx/not-valid-id",
    });

    expect(response.statusCode).toBe(400);
  });

  it("returns operational health metadata", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);

    const body = response.json() as {
      status: string;
      transactions: number;
      uptimeSeconds: number;
      version: string;
    };

    expect(body.status).toBe("ok");
    expect(typeof body.transactions).toBe("number");
    expect(typeof body.uptimeSeconds).toBe("number");
    expect(typeof body.version).toBe("string");
  });
});
