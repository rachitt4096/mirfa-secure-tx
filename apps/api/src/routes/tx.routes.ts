import type { FastifyInstance } from "fastify";
import { ValidationError } from "@mirfa/crypto";
import { ApiEncryptionService } from "../services/encryption.service.js";
import { StorageService } from "../services/storage.service.js";

const PARTY_ID_PATTERN = "^[a-zA-Z0-9_-]{3,64}$";
const TX_ID_PATTERN = "^tx_[a-f0-9]{32}$";
const MAX_PAYLOAD_BYTES = 64 * 1024;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function txRoutes(fastify: FastifyInstance): Promise<void> {
  const storage = new StorageService();

  const masterKey = process.env.MASTER_KEY;
  if (!masterKey) {
    throw new Error("MASTER_KEY environment variable is required");
  }

  const encryption = new ApiEncryptionService(masterKey);

  fastify.get("/", async () => {
    return {
      success: true,
      service: "mirfa-secure-tx-api",
      message: "Use /tx endpoints for transactions and /health for runtime status",
      endpoints: [
        "GET /health",
        "GET /tx",
        "GET /tx/:id",
        "POST /tx/encrypt",
        "POST /tx/:id/decrypt",
      ],
      transactions: storage.count(),
    };
  });

  fastify.post<{
    Body: { partyId: string; payload: Record<string, unknown> };
  }>(
    "/tx/encrypt",
    {
      schema: {
        body: {
          type: "object",
          required: ["partyId", "payload"],
          additionalProperties: false,
          properties: {
            partyId: {
              type: "string",
              minLength: 3,
              maxLength: 64,
              pattern: PARTY_ID_PATTERN,
            },
            payload: {
              type: "object",
              additionalProperties: true,
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { partyId, payload } = request.body;

      if (!isPlainObject(payload)) {
        return reply.code(400).send({
          error: "payload must be a valid JSON object",
        });
      }

      const payloadBytes = Buffer.byteLength(JSON.stringify(payload), "utf-8");
      if (payloadBytes > MAX_PAYLOAD_BYTES) {
        return reply.code(413).send({
          error: "payload exceeds max allowed size",
        });
      }

      try {
        const record = encryption.encryptPayload(partyId, payload);
        storage.save(record);

        fastify.log.info(
          { txId: record.id, partyId },
          "Transaction encrypted and stored",
        );

        return reply.code(201).send({
          success: true,
          id: record.id,
          record,
        });
      } catch (error) {
        fastify.log.error(error, "Encryption failed");
        return reply.code(500).send({
          error: "Failed to encrypt transaction",
        });
      }
    },
  );

  fastify.get<{
    Params: { id: string };
  }>(
    "/tx/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", pattern: TX_ID_PATTERN },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const record = storage.findById(id);

      if (!record) {
        return reply.code(404).send({
          error: "Transaction not found",
        });
      }

      return {
        success: true,
        record,
      };
    },
  );

  fastify.post<{
    Params: { id: string };
  }>(
    "/tx/:id/decrypt",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", pattern: TX_ID_PATTERN },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const record = storage.findById(id);

      if (!record) {
        return reply.code(404).send({
          error: "Transaction not found",
        });
      }

      try {
        const payload = encryption.decryptRecord(record);

        fastify.log.info({ txId: id }, "Transaction decrypted");

        return {
          success: true,
          payload,
        };
      } catch (error) {
        if (error instanceof ValidationError) {
          fastify.log.warn(
            { txId: id, error: error.message },
            "Decryption validation failed",
          );
          return reply.code(400).send({ error: error.message });
        }

        const fallbackError =
          error instanceof Error ? error : new Error("Unknown decryption error");
        fastify.log.error({ txId: id, error: fallbackError.message }, "Decryption failed");
        return reply.code(500).send({ error: "Failed to decrypt transaction" });
      }
    },
  );

  fastify.get<{
    Querystring: { partyId?: string };
  }>(
    "/tx",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            partyId: {
              type: "string",
              minLength: 3,
              maxLength: 64,
              pattern: PARTY_ID_PATTERN,
            },
          },
        },
      },
    },
    async (request) => {
      const records = request.query.partyId
        ? storage.findByPartyId(request.query.partyId)
        : storage.list();
      return {
        success: true,
        count: records.length,
        records,
      };
    },
  );

  fastify.get("/health", async () => {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      transactions: storage.count(),
      uptimeSeconds: Math.floor(process.uptime()),
      version: process.env.npm_package_version ?? "unknown",
    };
  });
}
