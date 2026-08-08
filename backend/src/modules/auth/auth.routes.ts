import type { FastifyInstance } from "fastify";
import type { Db } from "../../db/client.js";
import { createAuthService } from "./auth.service.js";
import { loginSchema, signupSchema } from "./auth.schema.js";

export async function authRoutes(app: FastifyInstance, opts: { db: Db }): Promise<void> {
  const authService = createAuthService(opts.db);

  app.post("/auth/signup", async (request, reply) => {
    const input = signupSchema.parse(request.body);
    const result = await authService.signup(input);
    reply.status(201).send(result);
  });

  app.post("/auth/login", async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const result = await authService.login(input);
    reply.status(200).send(result);
  });
}
