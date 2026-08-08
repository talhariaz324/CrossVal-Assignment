import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";
import { db } from "../../src/db/client.js";
import type { Db } from "../../src/db/client.js";

export async function createTestApp(): Promise<{ app: FastifyInstance; db: Db }> {
  const app = await buildApp(db);
  await app.ready();
  return { app, db };
}

export async function resetDb(): Promise<void> {
  await db.execute(
    sql`TRUNCATE TABLE order_status_events, payments, line_items, orders, users RESTART IDENTITY CASCADE`,
  );
}

interface JsonResponse {
  statusCode: number;
  json: () => any;
}

export async function signupAndGetToken(
  app: FastifyInstance,
  email = `user-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
): Promise<{ token: string; userId: string; email: string }> {
  const res: JsonResponse = await app.inject({
    method: "POST",
    url: "/auth/signup",
    payload: { email, password: "password123" },
  });
  const body = res.json();
  return { token: body.token, userId: body.user.id, email };
}
