import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Money is stored as integer cents (BIGINT) everywhere in this schema.
 * No FLOAT/NUMERIC money columns anywhere — see domain/money.ts.
 */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Normalized (trim + lowercase) in the auth service before every read/write,
  // so this plain UNIQUE constraint is sufficient for case-insensitive emails
  // without needing the citext extension.
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    customerName: text("customer_name").notNull(),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    // Denormalized, trigger-maintained caches — see migrations/0001_triggers.sql.
    // Source of truth for the total is line_items; source of truth for amount
    // paid is payments. These caches exist so the concurrency-critical payment
    // path only needs a single indexed row read, not an aggregate scan.
    orderTotalCents: bigint("order_total_cents", { mode: "number" }).notNull().default(0),
    amountPaidCents: bigint("amount_paid_cents", { mode: "number" }).notNull().default(0),
    rowVersion: integer("row_version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_orders_user_id").on(table.userId),
    index("idx_orders_user_id_due_date").on(table.userId, table.dueDate),
    check("customer_name_not_blank", sql`btrim(${table.customerName}) <> ''`),
    check("order_total_cents_non_negative", sql`${table.orderTotalCents} >= 0`),
    check("amount_paid_cents_non_negative", sql`${table.amountPaidCents} >= 0`),
    check("amount_paid_never_exceeds_total", sql`${table.amountPaidCents} <= ${table.orderTotalCents}`),
  ],
);

export const lineItems = pgTable(
  "line_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceCents: bigint("unit_price_cents", { mode: "number" }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_line_items_order_id").on(table.orderId),
    check("description_not_blank", sql`btrim(${table.description}) <> ''`),
    check("quantity_at_least_one", sql`${table.quantity} >= 1`),
    check("unit_price_cents_non_negative", sql`${table.unitPriceCents} >= 0`),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    paidOn: date("paid_on", { mode: "string" }).notNull(),
    note: text("note"),
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_payments_order_id").on(table.orderId),
    check("amount_cents_at_least_one", sql`${table.amountCents} >= 1`),
    // Partial unique index: makes a retried payment request (same order +
    // same client-supplied idempotency key) structurally safe, not just an
    // application-layer promise. NULL keys are excluded so legacy/manual
    // rows without a key don't collide with each other.
    uniqueIndex("uq_payments_order_idempotency")
      .on(table.orderId, table.idempotencyKey)
      .where(sql`${table.idempotencyKey} IS NOT NULL`),
  ],
);

export const orderStatusEvents = pgTable(
  "order_status_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    reason: text("reason").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    triggeredByPaymentId: uuid("triggered_by_payment_id").references(() => payments.id),
  },
  (table) => [index("idx_status_events_order_id").on(table.orderId, table.occurredAt)],
);
