import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import type { Db } from "../../db/client.js";
import { users } from "../../db/schema.js";
import { EmailTakenError, UnauthenticatedError } from "../../domain/errors.js";
import { hashPassword, verifyPassword } from "./password.js";
import type { LoginInput, SignupInput } from "./auth.schema.js";

export interface AuthResult {
  token: string;
  user: { id: string; email: string };
}

function issueToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function createAuthService(db: Db) {
  return {
    async signup(input: SignupInput): Promise<AuthResult> {
      const existing = await db.query.users.findFirst({ where: eq(users.email, input.email) });
      if (existing) {
        throw new EmailTakenError();
      }

      const passwordHash = await hashPassword(input.password);
      const [user] = await db.insert(users).values({ email: input.email, passwordHash }).returning();
      if (!user) {
        throw new Error("Failed to create user");
      }

      return { token: issueToken(user.id), user: { id: user.id, email: user.email } };
    },

    async login(input: LoginInput): Promise<AuthResult> {
      const user = await db.query.users.findFirst({ where: eq(users.email, input.email) });
      if (!user) {
        throw new UnauthenticatedError("Invalid email or password");
      }

      const valid = await verifyPassword(user.passwordHash, input.password);
      if (!valid) {
        throw new UnauthenticatedError("Invalid email or password");
      }

      return { token: issueToken(user.id), user: { id: user.id, email: user.email } };
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
