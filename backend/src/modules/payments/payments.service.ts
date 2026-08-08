import { and, eq } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { orders, orderStatusEvents, payments } from "../../db/schema.js";
import { deriveOrderStatus } from "../../domain/orderStatus.js";
import { computeAmountDueCents } from "../../domain/orderTotals.js";
import { dollarsToCents } from "../../domain/money.js";
import { NotFoundError, OverpaymentError, ValidationError } from "../../domain/errors.js";
import type { RecordPaymentInput } from "./payments.schema.js";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * The concurrency-critical path. See README "Concurrency & consistency
 * approach" for the full write-up. Summary of the guarantee: sum(payments)
 * for an order can never exceed orders.order_total_cents, even under
 * concurrent requests, because:
 *
 *   1. `SELECT ... FOR UPDATE` takes a row lock on the order for the
 *      duration of this transaction, so a second concurrent request on the
 *      SAME order blocks until this one commits or rolls back, then re-reads
 *      the now-current amount_paid_cents before it validates.
 *   2. The `amount_paid_never_exceeds_total` CHECK constraint (schema.ts) is
 *      a DB-level backstop in case this application-layer check is ever
 *      bypassed by a future code path.
 *
 * Idempotency: the `idempotencyKey` (required, from the client's
 * `Idempotency-Key` header) makes retries of this exact request safe. If the
 * client's first attempt succeeded but the response was lost (timeout,
 * dropped connection), retrying with the same key returns the original
 * result instead of creating a second payment.
 */
export function createPaymentsService(db: Db) {
  return {
    async recordPayment(userId: string, orderId: string, idempotencyKey: string, input: RecordPaymentInput) {
      const amountCents = dollarsToCents(input.amount);
      if (amountCents < 1) {
        throw new ValidationError("Amount must be at least 0.01");
      }

      return db.transaction(async (tx: Tx) => {
        const existing = await tx.query.payments.findFirst({
          where: and(eq(payments.orderId, orderId), eq(payments.idempotencyKey, idempotencyKey)),
        });
        if (existing) {
          const order = await getOrderOwnedByUser(tx, orderId, userId);
          if (!order) throw new NotFoundError("Order");
          return buildResult(order, existing, false);
        }

        // Row lock: blocks a concurrent payment request on this same order
        // until this transaction commits or rolls back.
        const [order] = await tx
          .select()
          .from(orders)
          .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
          .for("update");
        if (!order) throw new NotFoundError("Order");

        const remainingCents = order.orderTotalCents - order.amountPaidCents;
        if (amountCents > remainingCents) {
          throw new OverpaymentError(amountCents, remainingCents);
        }

        const statusBefore = deriveOrderStatus({
          orderTotalCents: order.orderTotalCents,
          amountPaidCents: order.amountPaidCents,
          dueDate: order.dueDate,
          now: new Date(),
        });

        const [payment] = await tx
          .insert(payments)
          .values({ orderId, amountCents, paidOn: input.paidOn, note: input.note, idempotencyKey })
          .returning();
        if (!payment) throw new Error("Failed to record payment");

        // Trigger (0001_triggers_maintain_order_caches.sql) has already
        // updated orders.amount_paid_cents within this same transaction.
        const [updatedOrder] = await tx.select().from(orders).where(eq(orders.id, orderId));
        if (!updatedOrder) throw new Error("Order disappeared mid-transaction");

        const statusAfter = deriveOrderStatus({
          orderTotalCents: updatedOrder.orderTotalCents,
          amountPaidCents: updatedOrder.amountPaidCents,
          dueDate: updatedOrder.dueDate,
          now: new Date(),
        });

        if (statusAfter !== statusBefore) {
          await tx.insert(orderStatusEvents).values({
            orderId,
            fromStatus: statusBefore,
            toStatus: statusAfter,
            reason: "payment_recorded",
            triggeredByPaymentId: payment.id,
          });
        }

        return buildResult(updatedOrder, payment, true);
      });
    },

    async listPayments(userId: string, orderId: string) {
      const order = await db.query.orders.findFirst({
        where: and(eq(orders.id, orderId), eq(orders.userId, userId)),
      });
      if (!order) throw new NotFoundError("Order");
      return db.query.payments.findMany({
        where: eq(payments.orderId, orderId),
        orderBy: (p, { desc }) => [desc(p.paidOn), desc(p.createdAt)],
      });
    },

    async listStatusEvents(userId: string, orderId: string) {
      const order = await db.query.orders.findFirst({
        where: and(eq(orders.id, orderId), eq(orders.userId, userId)),
      });
      if (!order) throw new NotFoundError("Order");
      return db.query.orderStatusEvents.findMany({
        where: eq(orderStatusEvents.orderId, orderId),
        orderBy: (e, { desc }) => [desc(e.occurredAt)],
      });
    },
  };
}

async function getOrderOwnedByUser(tx: Tx, orderId: string, userId: string) {
  const [order] = await tx
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)));
  return order;
}

function buildResult(
  order: typeof orders.$inferSelect,
  payment: typeof payments.$inferSelect,
  isNew: boolean,
) {
  const status = deriveOrderStatus({
    orderTotalCents: order.orderTotalCents,
    amountPaidCents: order.amountPaidCents,
    dueDate: order.dueDate,
    now: new Date(),
  });
  return {
    isNew,
    payment,
    order: {
      id: order.id,
      customerName: order.customerName,
      dueDate: order.dueDate,
      orderTotalCents: order.orderTotalCents,
      amountPaidCents: order.amountPaidCents,
      amountDueCents: computeAmountDueCents(order.orderTotalCents, order.amountPaidCents),
      status,
      editable: order.amountPaidCents === 0,
    },
  };
}

export type PaymentsService = ReturnType<typeof createPaymentsService>;
