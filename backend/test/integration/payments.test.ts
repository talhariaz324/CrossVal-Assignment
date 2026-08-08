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

async function createSampleOrder(token: string) {
  const res = await app.inject({
    method: "POST",
    url: "/orders",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      customerName: "Acme Corp",
      dueDate: "2026-12-01",
      lineItems: [{ description: "Widget", quantity: 2, unitPrice: 500 }],
    },
  });
  return res.json().id as string;
}

function pay(app: FastifyInstance, token: string, orderId: string, key: string, body: Record<string, unknown>) {
  return app.inject({
    method: "POST",
    url: `/orders/${orderId}/payments`,
    headers: { authorization: `Bearer ${token}`, "idempotency-key": key },
    payload: body,
  });
}

describe("the exact sample scenario from the brief", () => {
  it("2x$500 order -> $400 payment -> partially_paid/$600 due -> $600 payment -> paid/$0 due -> $1 rejected", async () => {
    const { token } = await signupAndGetToken(app);
    const orderId = await createSampleOrder(token);

    const p1 = await pay(app, token, orderId, "k1", { amount: 400, paidOn: "2026-08-08" });
    expect(p1.statusCode).toBe(201);
    expect(p1.json().order.status).toBe("partially_paid");
    expect(p1.json().order.amountDueCents).toBe(60000);

    const p2 = await pay(app, token, orderId, "k2", { amount: 600, paidOn: "2026-08-08" });
    expect(p2.statusCode).toBe(201);
    expect(p2.json().order.status).toBe("paid");
    expect(p2.json().order.amountDueCents).toBe(0);

    const p3 = await pay(app, token, orderId, "k3", { amount: 1, paidOn: "2026-08-08" });
    expect(p3.statusCode).toBe(409);
    expect(p3.json().error.code).toBe("OVERPAYMENT");
    expect(p3.json().error.details.maxAllowedCents).toBe(0);
  });
});

describe("idempotency", () => {
  it("retrying the same Idempotency-Key returns the original payment, not a duplicate", async () => {
    const { token } = await signupAndGetToken(app);
    const orderId = await createSampleOrder(token);

    const first = await pay(app, token, orderId, "retry-key", { amount: 300, paidOn: "2026-08-08" });
    expect(first.statusCode).toBe(201);
    const second = await pay(app, token, orderId, "retry-key", { amount: 300, paidOn: "2026-08-08" });
    expect(second.statusCode).toBe(200);
    expect(second.json().payment.id).toBe(first.json().payment.id);

    const paymentsList = await app.inject({
      method: "GET",
      url: `/orders/${orderId}/payments`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(paymentsList.json().payments).toHaveLength(1);
  });

  it("rejects a payment request with no Idempotency-Key header", async () => {
    const { token } = await signupAndGetToken(app);
    const orderId = await createSampleOrder(token);
    const res = await app.inject({
      method: "POST",
      url: `/orders/${orderId}/payments`,
      headers: { authorization: `Bearer ${token}` },
      payload: { amount: 100, paidOn: "2026-08-08" },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("validation", () => {
  it("rejects a payment of $0", async () => {
    const { token } = await signupAndGetToken(app);
    const orderId = await createSampleOrder(token);
    const res = await pay(app, token, orderId, "zero-amount", { amount: 0, paidOn: "2026-08-08" });
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 for a payment against another user's order", async () => {
    const { token: tokenA } = await signupAndGetToken(app);
    const { token: tokenB } = await signupAndGetToken(app);
    const orderId = await createSampleOrder(tokenA);
    const res = await pay(app, tokenB, orderId, "cross-tenant", { amount: 100, paidOn: "2026-08-08" });
    expect(res.statusCode).toBe(404);
  });
});

describe("status events (audit log)", () => {
  it("records a status transition event when a payment changes the derived status", async () => {
    const { token } = await signupAndGetToken(app);
    const orderId = await createSampleOrder(token);

    await pay(app, token, orderId, "evt-1", { amount: 400, paidOn: "2026-08-08" });

    const res = await app.inject({
      method: "GET",
      url: `/orders/${orderId}/status-events`,
      headers: { authorization: `Bearer ${token}` },
    });
    const events = res.json().events;
    expect(events).toHaveLength(1);
    expect(events[0].fromStatus).toBe("pending");
    expect(events[0].toStatus).toBe("partially_paid");
    expect(events[0].reason).toBe("payment_recorded");
  });
});
