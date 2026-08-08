import { Link } from "react-router-dom";
import type { OrderSummary } from "../api/types";
import { formatCents } from "../lib/money";
import { StatusBadge } from "./StatusBadge";

export function OrderTable({ orders }: { orders: OrderSummary[] }) {
  if (orders.length === 0) {
    return <p className="empty-state">No orders yet.</p>;
  }

  return (
    <table className="order-table">
      <thead>
        <tr>
          <th>Customer</th>
          <th>Status</th>
          <th>Total</th>
          <th>Paid</th>
          <th>Due</th>
          <th>Due date</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((order) => (
          <tr key={order.id}>
            <td>
              <Link to={`/orders/${order.id}`}>{order.customerName}</Link>
            </td>
            <td>
              <StatusBadge status={order.status} />
            </td>
            <td>{formatCents(order.orderTotalCents)}</td>
            <td>{formatCents(order.amountPaidCents)}</td>
            <td>{formatCents(order.amountDueCents)}</td>
            <td>{order.dueDate}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
