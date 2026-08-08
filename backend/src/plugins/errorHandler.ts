import type { FastifyError, FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { DomainError } from "../domain/errors.js";

/**
 * Single place that turns any thrown error into the consistent envelope
 * `{ error: { code, message, details? } }`. Routes/services never format
 * error responses themselves — they just throw a DomainError subclass (or a
 * ZodError, which we translate here) and this handler does the rest.
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError | Error, request, reply) => {
    if (error instanceof DomainError) {
      reply.status(error.httpStatus).send({
        error: { code: error.code, message: error.message, details: error.details },
      });
      return;
    }

    if (error instanceof ZodError) {
      reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: { issues: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
        },
      });
      return;
    }

    // FastifyError from schema/body parsing etc.
    if (typeof (error as { statusCode?: number }).statusCode === "number" && (error as { statusCode: number }).statusCode < 500) {
      reply.status((error as { statusCode: number }).statusCode).send({
        error: { code: "VALIDATION_ERROR", message: error.message },
      });
      return;
    }

    request.log.error({ err: error, requestId: request.id }, "Unhandled error");
    reply.status(500).send({
      error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
    });
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({ error: { code: "NOT_FOUND", message: "Route not found" } });
  });
}
