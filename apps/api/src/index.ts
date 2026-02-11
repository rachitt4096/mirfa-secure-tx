import "dotenv/config";
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { txRoutes } from "./routes/tx.routes.js";
import { registerErrorHandler } from "./middleware/error-handler.js";

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

function parsePositiveInt(
  envName: string,
  fallback: number,
  min = 1,
  max = Number.MAX_SAFE_INTEGER,
): number {
  const raw = process.env[envName];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < min || parsed > max) {
    throw new Error(`${envName} must be an integer between ${min} and ${max}`);
  }

  return parsed;
}

function resolveCorsOrigins(): true | string[] {
  const configuredOrigins = process.env.CORS_ORIGIN;

  if (!configuredOrigins || configuredOrigins.trim() === "" || configuredOrigins === "*") {
    return true;
  }

  return configuredOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function assertRequiredEnv(): void {
  let masterKey = process.env.MASTER_KEY?.trim();

  if (!masterKey && process.env.NODE_ENV === "development") {
    masterKey = randomBytes(32).toString("hex");
    process.env.MASTER_KEY = masterKey;
    // Helps local startup while keeping strict behavior in non-development environments.
    console.warn(
      "[api] MASTER_KEY not set. Generated ephemeral development key for this process.",
    );
  }

  if (!masterKey) {
    throw new Error("MASTER_KEY environment variable is required");
  }

  if (!/^[0-9a-fA-F]{64}$/.test(masterKey)) {
    throw new Error("MASTER_KEY must be a 64-char hex string");
  }
}

export function buildApp() {
  assertRequiredEnv();
  const apiKey = process.env.API_KEY?.trim();
  const rateLimitWindowMs = parsePositiveInt("RATE_LIMIT_WINDOW_MS", 60_000, 1_000, 3_600_000);
  const rateLimitMax = parsePositiveInt("RATE_LIMIT_MAX", 120, 1, 10_000);
  const rateLimitBuckets = new Map<string, RateLimitBucket>();

  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || "info",
    },
    bodyLimit: 64 * 1024,
  });

  app.addHook("onRequest", async (request, reply) => {
    const path = request.url.split("?")[0] ?? request.url;
    const isHealth = path === "/health";
    const isTxRoute = path.startsWith("/tx");

    if (apiKey && isTxRoute) {
      const receivedApiKey = request.headers["x-api-key"];
      if (typeof receivedApiKey !== "string" || receivedApiKey !== apiKey) {
        return reply.status(401).send({
          error: "Unauthorized",
          message: "Missing or invalid x-api-key header",
          requestId: request.id,
        });
      }
    }

    if (!isHealth) {
      const bucketKey = `${request.ip}:${isTxRoute ? "/tx" : path}`;
      const now = Date.now();
      const bucket = rateLimitBuckets.get(bucketKey);

      if (!bucket || now > bucket.resetAt) {
        rateLimitBuckets.set(bucketKey, {
          count: 1,
          resetAt: now + rateLimitWindowMs,
        });
      } else {
        bucket.count += 1;

        if (bucket.count > rateLimitMax) {
          const retryAfterSeconds = Math.max(
            1,
            Math.ceil((bucket.resetAt - now) / 1000),
          );

          reply.header("Retry-After", retryAfterSeconds.toString());
          return reply.status(429).send({
            error: "RateLimitExceeded",
            message: `Too many requests. Retry in ${retryAfterSeconds}s`,
            requestId: request.id,
          });
        }
      }
    }
  });

  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    reply.header("Cache-Control", "no-store");
    return payload;
  });

  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of rateLimitBuckets.entries()) {
      if (now > bucket.resetAt) {
        rateLimitBuckets.delete(key);
      }
    }
  }, rateLimitWindowMs);
  cleanupTimer.unref();

  app.addHook("onClose", async () => {
    clearInterval(cleanupTimer);
  });

  app.register(cors, {
    origin: resolveCorsOrigins(),
    credentials: true,
  });

  app.register(txRoutes);

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: "NotFound",
      message: `Route ${request.method} ${request.url} not found`,
      requestId: request.id,
    });
  });

  registerErrorHandler(app);
  return app;
}

const fastify = buildApp();

const start = async (): Promise<void> => {
  try {
    const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3001;
    const host = process.env.HOST || "0.0.0.0";

    await fastify.listen({ port, host });
    fastify.log.info(`Server running at http://${host}:${port}`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
};

const entry = process.argv[1];
const isDirectExecution =
  typeof entry === "string" && pathToFileURL(entry).href === import.meta.url;
const isServerlessRuntime = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME,
);

if (isDirectExecution && process.env.NODE_ENV !== "test" && !isServerlessRuntime) {
  await start();

  const shutdown = async (signal: string): Promise<void> => {
    fastify.log.info({ signal }, "Shutting down gracefully");
    await fastify.close();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    shutdown("SIGINT").catch((error) => {
      fastify.log.error(error);
      process.exit(1);
    });
  });

  process.on("SIGTERM", () => {
    shutdown("SIGTERM").catch((error) => {
      fastify.log.error(error);
      process.exit(1);
    });
  });
}

export { fastify };
