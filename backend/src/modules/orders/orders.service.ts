import { computeAmountDueCents } from "../../domain/orderTotals.js";
import { deriveOrderStatus } from "../../domain/orderStatus.js";
import { dollarsToCents } from "../../domain/money.js";
import { NotFoundError, OrderLockedError, ValidationError } from "../../domain/errors.js";
import type { OrderRow, OrdersRepository } from "./orders.repository.js";
import type { CreateOrderInput, ListOrdersQuery, UpdateOrderInput } from "./orders.schema.js";

function toSummaryDto(order: OrderRow, now: Date) {
  const status = deriveOrderStatus({
    orderTotalCents: order.orderTotalCents,
    amountPaidCents: order.amountPaidCents,
    dueDate: order.dueDate,
    now,
  });
  return {
    id: order.id,
    customerName: order.customerName,
    dueDate: order.dueDate,
    orderTotalCents: order.orderTotalCents,
    amountPaidCents: order.amountPaidCents,
    amountDueCents: computeAmountDueCents(order.orderTotalCents, order.amountPaidCents),
    status,
    editable: order.amountPaidCents === 0,
  };
}

function toLineItemsForInsert(items: CreateOrderInput["lineItems"] | NonNullable<UpdateOrderInput["lineItems"]>) {
  return items.map((item, index) => ({
    description: item.description,
    quantity: item.quantity,
    unitPriceCents: dollarsToCents(item.unitPrice),
    sortOrder: index,
  }));
}

export function createOrdersService(repo: OrdersRepository) {
  return {
    async create(userId: string, input: CreateOrderInput) {
      const order = await repo.create(
        userId,
        { customerName: input.customerName, dueDate: input.dueDate },
        toLineItemsForInsert(input.lineItems),
      );
      const lineItemRows = await repo.findLineItems(order.id);
      return { ...toSummaryDto(order, new Date()), lineItems: lineItemRows, payments: [] };
    },

    async list(userId: string, query: ListOrdersQuery) {
      const rows = await repo.listByUser(userId);
      const now = new Date();
      const summaries = rows.map((row) => toSummaryDto(row, now));
      return query.status ? summaries.filter((s) => s.status === query.status) : summaries;
    },

    async getById(userId: string, orderId: string) {
      const order = await repo.findById(orderId, userId);
      if (!order) throw new NotFoundError("Order");

      const [lineItemRows, paymentRows] = await Promise.all([
        repo.findLineItems(order.id),
        repo.findPayments(order.id),
      ]);

      return { ...toSummaryDto(order, new Date()), lineItems: lineItemRows, payments: paymentRows };
    },

    async update(userId: string, orderId: string, input: UpdateOrderInput) {
      const order = await repo.findById(orderId, userId);
      if (!order) throw new NotFoundError("Order");

      const editingLockedFields = input.dueDate !== undefined || input.lineItems !== undefined;
      if (editingLockedFields && order.amountPaidCents > 0) {
        throw new OrderLockedError();
      }
      if (Object.keys(input).length === 0) {
        throw new ValidationError("No fields provided to update");
      }

      const patch: { customerName?: string; dueDate?: string } = {};
      if (input.customerName !== undefined) patch.customerName = input.customerName;
      if (input.dueDate !== undefined) patch.dueDate = input.dueDate;

      const items = input.lineItems ? toLineItemsForInsert(input.lineItems) : undefined;

      const updated = await repo.replaceLineItemsAndMetadata(orderId, patch, items);
      const [lineItemRows, paymentRows] = await Promise.all([
        repo.findLineItems(orderId),
        repo.findPayments(orderId),
      ]);

      return { ...toSummaryDto(updated, new Date()), lineItems: lineItemRows, payments: paymentRows };
    },

    async remove(userId: string, orderId: string) {
      const order = await repo.findById(orderId, userId);
      if (!order) throw new NotFoundError("Order");
      await repo.delete(orderId);
    },
  };
}

export type OrdersService = ReturnType<typeof createOrdersService>;
export { toSummaryDto };
