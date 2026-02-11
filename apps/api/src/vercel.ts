import type { IncomingMessage, ServerResponse } from "node:http";
import { fastify } from "./index.js";

let readyPromise: PromiseLike<unknown> | null = null;

async function ensureReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = fastify.ready();
  }

  await readyPromise;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  await ensureReady();
  fastify.server.emit("request", req, res);
}
