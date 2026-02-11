import { ValidationError } from "@mirfa/crypto";
import type { FastifyError, FastifyInstance } from "fastify";

export function registerErrorHandler(fastify: FastifyInstance): void {
  fastify.setErrorHandler((error, request, reply) => {
    const fastifyError = error as FastifyError & { validation?: unknown };

    if (fastifyError.validation) {
      reply.status(400).send({
        error: "ValidationError",
        message: fastifyError.message,
        requestId: request.id,
      });
      return;
    }

    if (error instanceof ValidationError) {
      reply.status(400).send({
        error: "ValidationError",
        message: error.message,
        requestId: request.id,
      });
      return;
    }

    const statusCode =
      fastifyError.statusCode && fastifyError.statusCode >= 400
        ? fastifyError.statusCode
        : 500;

    if (statusCode >= 500) {
      fastify.log.error(error);
    } else {
      fastify.log.warn({ err: error, requestId: request.id });
    }

    reply.status(statusCode).send({
      error: statusCode === 404 ? "NotFound" : "InternalServerError",
      message:
        statusCode === 500
          ? "Internal Server Error"
          : (fastifyError.message || "Request failed"),
      requestId: request.id,
    });
  });
}
