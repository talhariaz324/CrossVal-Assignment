export type OrderStatus = "pending" | "partially_paid" | "paid" | "overdue";

export interface OrderSummary {
  id: string;
  customerName: string;
  dueDate: string;
  orderTotalCents: number;
  amountPaidCents: number;
  amountDueCents: number;
  status: OrderStatus;
  editable: boolean;
}

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
}

export interface Payment {
  id: string;
  orderId: string;
  amountCents: number;
  paidOn: string;
  note: string | null;
  createdAt: string;
}

export interface OrderDetail extends OrderSummary {
  lineItems: LineItem[];
  payments: Payment[];
}

export interface StatusEvent {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  reason: string;
  occurredAt: string;
}
