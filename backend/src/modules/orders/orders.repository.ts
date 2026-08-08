import { and, eq } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { lineItems, orders, payments } from "../../db/schema.js";

export type OrderRow = typeof orders.$inferSelect;
export type LineItemRow = typeof lineItems.$inferSelect;
export type PaymentRow = typeof payments.$inferSelect;

export function createOrdersRepository(db: Db) {
  return {
    async listByUser(userId: string): Promise<OrderRow[]> {
      return db.query.orders.findMany({
        where: eq(orders.userId, userId),
        orderBy: (o, { desc }) => [desc(o.createdAt)],
      });
    },

    async findById(orderId: string, userId: string): Promise<OrderRow | undefined> {
      return db.query.orders.findFirst({
        where: and(eq(orders.id, orderId), eq(orders.userId, userId)),
      });
    },

    async findLineItems(orderId: string): Promise<LineItemRow[]> {
      return db.query.lineItems.findMany({
        where: eq(lineItems.orderId, orderId),
        orderBy: (li, { asc }) => [asc(li.sortOrder), asc(li.createdAt)],
      });
    },

    async findPayments(orderId: string): Promise<PaymentRow[]> {
      return db.query.payments.findMany({
        where: eq(payments.orderId, orderId),
        orderBy: (p, { desc }) => [desc(p.paidOn), desc(p.createdAt)],
      });
    },

    async create(
      userId: string,
      input: { customerName: string; dueDate: string },
      items: { description: string; quantity: number; unitPriceCents: number; sortOrder: number }[],
    ): Promise<OrderRow> {
      return db.transaction(async (tx) => {
        const [order] = await tx
          .insert(orders)
          .values({ userId, customerName: input.customerName, dueDate: input.dueDate })
          .returning();
        if (!order) throw new Error("Failed to create order");

        if (items.length > 0) {
          await tx.insert(lineItems).values(items.map((item) => ({ ...item, orderId: order.id })));
        }

        // Re-fetch: the line_items trigger updates orders.order_total_cents
        // in the same transaction, but the `order` object above was returned
        // before that insert ran.
        const [fresh] = await tx.select().from(orders).where(eq(orders.id, order.id));
        return fresh!;
      });
    },

    async replaceLineItemsAndMetadata(
      orderId: string,
      patch: { customerName?: string; dueDate?: string },
      items?: { description: string; quantity: number; unitPriceCents: number; sortOrder: number }[],
    ): Promise<OrderRow> {
      return db.transaction(async (tx) => {
        if (Object.keys(patch).length > 0) {
          await tx.update(orders).set({ ...patch, updatedAt: new Date() }).where(eq(orders.id, orderId));
        }

        if (items) {
          await tx.delete(lineItems).where(eq(lineItems.orderId, orderId));
          if (items.length > 0) {
            await tx.insert(lineItems).values(items.map((item) => ({ ...item, orderId })));
          }
        }

        const [fresh] = await tx.select().from(orders).where(eq(orders.id, orderId));
        return fresh!;
      });
    },

    async delete(orderId: string): Promise<void> {
      await db.delete(orders).where(eq(orders.id, orderId));
    },
  };
}

export type OrdersRepository = ReturnType<typeof createOrdersRepository>;
