import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { createTestApp, resetDb, signupAndGetToken } from "../setup/testApp.js";
import { orders } from "../../src/db/schema.js";
import type { Db } from "../../src/db/client.js";

let app: FastifyInstance;
let db: Db;

beforeAll(async () => {
  ({ app, db } = await createTestApp());
});

afterEach(async () => {
  await resetDb();
});

async function createOrder(token: string, totalDollars: number) {
  const res = await app.inject({
    method: "POST",
    url: "/orders",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      customerName: "Race Co",
      dueDate: "2026-12-01",
      lineItems: [{ description: "Service", quantity: 1, unitPrice: totalDollars }],
    },
  });
  return res.json().id as string;
}

function pay(token: string, orderId: string, key: string, amount: number) {
  return app.inject({
    method: "POST",
    url: `/orders/${orderId}/payments`,
    headers: { authorization: `Bearer ${token}`, "idempotency-key": key },
    payload: { amount, paidOn: "2026-08-08" },
  });
}

describe("concurrent payment requests on the same order", () => {
  it(
    "accepts exactly one of two overlapping $700 payments against a $1000 order " +
      "(the pair sums to $1400, which would overpay) — the DB invariant amount_paid_cents <= order_total_cents must hold",
    async () => {
      const { token } = await signupAndGetToken(app);
      const orderId = await createOrder(token, 1000);

      const [resA, resB] = await Promise.all([
        pay(token, orderId, "race-a", 700),
        pay(token, orderId, "race-b", 700),
      ]);

      const statuses = [resA.statusCode, resB.statusCode].sort();
      expect(statuses).toEqual([201, 409]);

      const rejected = resA.statusCode === 409 ? resA : resB;
      expect(rejected.json().error.code).toBe("OVERPAYMENT");

      const [orderRow] = await db.select().from(orders).where(eq(orders.id, orderId));
      expect(orderRow!.amountPaidCents).toBe(70000);
      expect(orderRow!.amountPaidCents).toBeLessThanOrEqual(orderRow!.orderTotalCents);
    },
  );

  it("accepts both of two overlapping payments that together do NOT exceed the total", async () => {
    const { token } = await signupAndGetToken(app);
    const orderId = await createOrder(token, 1000);

    const [resA, resB] = await Promise.all([
      pay(token, orderId, "ok-a", 400),
      pay(token, orderId, "ok-b", 500),
    ]);

    expect(resA.statusCode).toBe(201);
    expect(resB.statusCode).toBe(201);

    const [orderRow] = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(orderRow!.amountPaidCents).toBe(90000);
  });
});
