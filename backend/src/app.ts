import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import type { Db } from "./db/client.js";
import { env } from "./config/env.js";
import { registerErrorHandler } from "./plugins/errorHandler.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { ordersRoutes } from "./modules/orders/orders.routes.js";
import { paymentsRoutes } from "./modules/payments/payments.routes.js";

export async function buildApp(db: Db): Promise<FastifyInstance> {
  const app = Fastify({ logger: env.NODE_ENV !== "test" });

  await app.register(cors, { origin: env.CORS_ORIGIN });

  registerErrorHandler(app);

  // Used by the deployment platform's health check and as the operational
  // surface for the SLO narrative in the README (payments fail closed if
  // this can't reach the DB).
  app.get("/health", async (_request, reply) => {
    try {
      await db.execute(sql`SELECT 1`);
      reply.send({ status: "ok" });
    } catch {
      reply.status(503).send({ status: "unavailable" });
    }
  });

  await app.register(authRoutes, { db });
  await app.register(ordersRoutes, { db });
  await app.register(paymentsRoutes, { db });

  return app;
}
