import type { FastifyInstance } from "fastify";
import type { Db } from "../../db/client.js";
import { authenticate } from "../../plugins/authenticate.js";
import { UnauthenticatedError, ValidationError } from "../../domain/errors.js";
import { createPaymentsService } from "./payments.service.js";
import { recordPaymentSchema } from "./payments.schema.js";

export async function paymentsRoutes(app: FastifyInstance, opts: { db: Db }): Promise<void> {
  const service = createPaymentsService(opts.db);

  app.addHook("preHandler", authenticate);

  function userId(request: { user?: { id: string } }): string {
    if (!request.user) throw new UnauthenticatedError("Not authenticated");
    return request.user.id;
  }

  app.post<{ Params: { id: string } }>("/orders/:id/payments", async (request, reply) => {
    const idempotencyKey = request.headers["idempotency-key"];
    if (!idempotencyKey || typeof idempotencyKey !== "string") {
      throw new ValidationError(
        "Idempotency-Key header is required so a retried request can never create a duplicate payment",
      );
    }

    const input = recordPaymentSchema.parse(request.body);
    const result = await service.recordPayment(userId(request), request.params.id, idempotencyKey, input);
    reply.status(result.isNew ? 201 : 200).send({ order: result.order, payment: result.payment });
  });

  app.get<{ Params: { id: string } }>("/orders/:id/payments", async (request, reply) => {
    const payments = await service.listPayments(userId(request), request.params.id);
    reply.send({ payments });
  });

  app.get<{ Params: { id: string } }>("/orders/:id/status-events", async (request, reply) => {
    const events = await service.listStatusEvents(userId(request), request.params.id);
    reply.send({ events });
  });
}
