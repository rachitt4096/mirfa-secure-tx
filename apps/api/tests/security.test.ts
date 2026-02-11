import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";

function createMasterKey(): string {
  return randomBytes(32).toString("hex");
}

async function withApp(run: (app: FastifyInstance) => Promise<void>): Promise<void> {
  const { buildApp } = await import("../src/index.js");
  const app = buildApp();
  await app.ready();
  try {
    await run(app);
  } finally {
    await app.close();
  }
}

describe.sequential("API security controls", () => {
  afterEach(() => {
    delete process.env.API_KEY;
    delete process.env.RATE_LIMIT_MAX;
    delete process.env.RATE_LIMIT_WINDOW_MS;
  });

  it("rejects tx routes when API key is configured and missing", async () => {
    process.env.NODE_ENV = "test";
    process.env.MASTER_KEY = createMasterKey();
    process.env.API_KEY = "secret-key";

    await withApp(async (app) => {
      const unauthorized = await app.inject({
        method: "POST",
        url: "/tx/encrypt",
        payload: {
          partyId: "party_123",
          payload: { amount: 100 },
        },
      });

      expect(unauthorized.statusCode).toBe(401);

      const authorized = await app.inject({
        method: "POST",
        url: "/tx/encrypt",
        headers: {
          "x-api-key": "secret-key",
        },
        payload: {
          partyId: "party_123",
          payload: { amount: 100 },
        },
      });

      expect(authorized.statusCode).toBe(201);
    });
  });

  it("returns 429 after crossing configured rate limit", async () => {
    process.env.NODE_ENV = "test";
    process.env.MASTER_KEY = createMasterKey();
    process.env.RATE_LIMIT_MAX = "1";
    process.env.RATE_LIMIT_WINDOW_MS = "60000";

    await withApp(async (app) => {
      const first = await app.inject({
        method: "GET",
        url: "/tx",
      });
      expect(first.statusCode).toBe(200);

      const second = await app.inject({
        method: "GET",
        url: "/tx",
      });
      expect(second.statusCode).toBe(429);
      expect(second.headers["retry-after"]).toBeDefined();
    });
  });
});
