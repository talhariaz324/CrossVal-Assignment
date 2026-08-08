import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp, resetDb, signupAndGetToken } from "../setup/testApp.js";

let app: FastifyInstance;

beforeAll(async () => {
  ({ app } = await createTestApp());
});

afterEach(async () => {
  await resetDb();
});

async function createOrder(token: string, overrides: Record<string, unknown> = {}) {
  return app.inject({
    method: "POST",
    url: "/orders",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      customerName: "Acme Corp",
      dueDate: "2026-12-01",
      lineItems: [{ description: "Widget", quantity: 2, unitPrice: 500 }],
      ...overrides,
    },
  });
}

describe("POST /orders", () => {
  it("creates an order and computes the total server-side (2 x $500 = $1000)", async () => {
    const { token } = await signupAndGetToken(app);
    const res = await createOrder(token);
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.orderTotalCents).toBe(100000);
    expect(body.amountDueCents).toBe(100000);
    expect(body.status).toBe("pending");
    expect(body.editable).toBe(true);
  });

  it("rejects a line item with quantity 0", async () => {
    const { token } = await signupAndGetToken(app);
    const res = await createOrder(token, {
      lineItems: [{ description: "Widget", quantity: 0, unitPrice: 500 }],
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a negative unit price", async () => {
    const { token } = await signupAndGetToken(app);
    const res = await createOrder(token, {
      lineItems: [{ description: "Widget", quantity: 1, unitPrice: -5 }],
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects an order with no line items", async () => {
    const { token } = await signupAndGetToken(app);
    const res = await createOrder(token, { lineItems: [] });
    expect(res.statusCode).toBe(400);
  });
});

describe("tenant isolation", () => {
  it("returns 404 (not 403) when a user requests another user's order", async () => {
    const { token: tokenA } = await signupAndGetToken(app);
    const { token: tokenB } = await signupAndGetToken(app);
    const created = await createOrder(tokenA);
    const orderId = created.json().id;

    const res = await app.inject({
      method: "GET",
      url: `/orders/${orderId}`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("does not include another user's orders in the list", async () => {
    const { token: tokenA } = await signupAndGetToken(app);
    const { token: tokenB } = await signupAndGetToken(app);
    await createOrder(tokenA);

    const res = await app.inject({
      method: "GET",
      url: "/orders",
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(res.json().orders).toHaveLength(0);
  });
});

describe("editability lock", () => {
  it("allows editing line items on a draft order with no payments", async () => {
    const { token } = await signupAndGetToken(app);
    const created = await createOrder(token);
    const orderId = created.json().id;

    const res = await app.inject({
      method: "PATCH",
      url: `/orders/${orderId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { customerName: "Renamed Corp" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().customerName).toBe("Renamed Corp");
  });

  it("rejects editing line items/due date once a payment has been recorded (409 ORDER_LOCKED)", async () => {
    const { token } = await signupAndGetToken(app);
    const created = await createOrder(token);
    const orderId = created.json().id;

    await app.inject({
      method: "POST",
      url: `/orders/${orderId}/payments`,
      headers: { authorization: `Bearer ${token}`, "idempotency-key": "lock-test" },
      payload: { amount: 100, paidOn: "2026-08-08" },
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/orders/${orderId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { dueDate: "2027-01-01" },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("ORDER_LOCKED");
  });

  it("still allows renaming the customer after a payment (cosmetic field stays editable)", async () => {
    const { token } = await signupAndGetToken(app);
    const created = await createOrder(token);
    const orderId = created.json().id;

    await app.inject({
      method: "POST",
      url: `/orders/${orderId}/payments`,
      headers: { authorization: `Bearer ${token}`, "idempotency-key": "cosmetic-test" },
      payload: { amount: 100, paidOn: "2026-08-08" },
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/orders/${orderId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { customerName: "Still Renamable Inc" },
    });
    expect(res.statusCode).toBe(200);
  });
});
