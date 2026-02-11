import type { IncomingMessage, ServerResponse } from "node:http";
import type { FastifyInstance } from "fastify";

let appPromise: Promise<FastifyInstance> | null = null;

async function getApp(): Promise<FastifyInstance> {
  if (!appPromise) {
    appPromise = (async () => {
      const { fastify } = await import("./index.js");
      await fastify.ready();
      return fastify;
    })();
  }

  return appPromise;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const app = await getApp();
    app.server.emit("request", req, res);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown initialization error";
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        error: "Server initialization failed",
        reason,
      }),
    );
  }
}
