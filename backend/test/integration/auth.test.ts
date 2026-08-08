import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp, resetDb } from "../setup/testApp.js";

let app: FastifyInstance;

beforeAll(async () => {
  ({ app } = await createTestApp());
});

afterEach(async () => {
  await resetDb();
});

describe("POST /auth/signup", () => {
  it("creates an account and returns a token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/signup",
      payload: { email: "alice@example.com", password: "password123" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.token).toBeTruthy();
    expect(body.user.email).toBe("alice@example.com");
  });

  it("rejects a duplicate email with a 409", async () => {
    await app.inject({
      method: "POST",
      url: "/auth/signup",
      payload: { email: "bob@example.com", password: "password123" },
    });
    const res = await app.inject({
      method: "POST",
      url: "/auth/signup",
      payload: { email: "bob@example.com", password: "password456" },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("EMAIL_TAKEN");
  });

  it("normalizes email case so Bob@Example.com collides with bob@example.com", async () => {
    await app.inject({
      method: "POST",
      url: "/auth/signup",
      payload: { email: "case@example.com", password: "password123" },
    });
    const res = await app.inject({
      method: "POST",
      url: "/auth/signup",
      payload: { email: "Case@Example.com", password: "password123" },
    });
    expect(res.statusCode).toBe(409);
  });

  it("rejects a password shorter than 8 characters with a validation error", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/signup",
      payload: { email: "short@example.com", password: "abc" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /auth/login", () => {
  it("logs in with correct credentials", async () => {
    await app.inject({
      method: "POST",
      url: "/auth/signup",
      payload: { email: "carol@example.com", password: "password123" },
    });
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "carol@example.com", password: "password123" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().token).toBeTruthy();
  });

  it("rejects an incorrect password with 401", async () => {
    await app.inject({
      method: "POST",
      url: "/auth/signup",
      payload: { email: "dave@example.com", password: "password123" },
    });
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "dave@example.com", password: "wrongpassword" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects a nonexistent email with 401 (not a distinguishable 404)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "nobody@example.com", password: "password123" },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("protected routes", () => {
  it("rejects a request with no Authorization header with 401", async () => {
    const res = await app.inject({ method: "GET", url: "/orders" });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("UNAUTHENTICATED");
  });

  it("rejects a request with a malformed token with 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/orders",
      headers: { authorization: "Bearer not-a-real-token" },
    });
    expect(res.statusCode).toBe(401);
  });
});
