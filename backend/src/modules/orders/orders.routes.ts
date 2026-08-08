import type { FastifyInstance } from "fastify";
import type { Db } from "../../db/client.js";
import { authenticate } from "../../plugins/authenticate.js";
import { UnauthenticatedError } from "../../domain/errors.js";
import { createOrdersRepository } from "./orders.repository.js";
import { createOrdersService } from "./orders.service.js";
import { createOrderSchema, listOrdersQuerySchema, updateOrderSchema } from "./orders.schema.js";

export async function ordersRoutes(app: FastifyInstance, opts: { db: Db }): Promise<void> {
  const service = createOrdersService(createOrdersRepository(opts.db));

  app.addHook("preHandler", authenticate);

  function userId(request: { user?: { id: string } }): string {
    if (!request.user) throw new UnauthenticatedError("Not authenticated");
    return request.user.id;
  }

  app.get("/orders", async (request, reply) => {
    const query = listOrdersQuerySchema.parse(request.query);
    const orders = await service.list(userId(request), query);
    reply.send({ orders });
  });

  app.post("/orders", async (request, reply) => {
    const input = createOrderSchema.parse(request.body);
    const order = await service.create(userId(request), input);
    reply.status(201).send(order);
  });

  app.get<{ Params: { id: string } }>("/orders/:id", async (request, reply) => {
    const order = await service.getById(userId(request), request.params.id);
    reply.send(order);
  });

  app.patch<{ Params: { id: string } }>("/orders/:id", async (request, reply) => {
    const input = updateOrderSchema.parse(request.body);
    const order = await service.update(userId(request), request.params.id, input);
    reply.send(order);
  });

  app.delete<{ Params: { id: string } }>("/orders/:id", async (request, reply) => {
    await service.remove(userId(request), request.params.id);
    reply.status(204).send();
  });
}
