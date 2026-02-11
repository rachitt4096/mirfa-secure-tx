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

async function dispatchRequest(
  app: FastifyInstance,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const onFinish = (): void => {
      cleanup();
      resolve();
    };
    const onClose = (): void => {
      cleanup();
      resolve();
    };
    const onError = (error: Error): void => {
      cleanup();
      reject(error);
    };
    const cleanup = (): void => {
      res.off("finish", onFinish);
      res.off("close", onClose);
      res.off("error", onError);
    };

    res.on("finish", onFinish);
    res.on("close", onClose);
    res.on("error", onError);
    app.server.emit("request", req, res);
  });
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const app = await getApp();
    await dispatchRequest(app, req, res);
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
