import { Link } from "react-router-dom";
import type { OrderSummary } from "../api/types";
import { formatCents } from "../lib/money";
import { formatDate } from "../lib/date";
import { StatusBadge } from "./StatusBadge";
import { Card } from "./Card";
import { EmptyState } from "./EmptyState";
import { InboxIcon, PlusIcon } from "./icons";

export function OrderTable({ orders }: { orders: OrderSummary[] }) {
  if (orders.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<InboxIcon />}
          title="No orders yet"
          description="Create your first order to start tracking payments against it."
          action={
            <Link to="/orders/new" className="btn btn--primary btn--sm">
              <PlusIcon />
              New order
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <Card className="card--table">
      <table className="order-table">
        <thead>
          <tr>
            <th>Customer</th>
            <th>Status</th>
            <th className="num-cell">Total</th>
            <th className="num-cell">Paid</th>
            <th className="num-cell">Due</th>
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
              <td className="num-cell">{formatCents(order.orderTotalCents)}</td>
              <td className="num-cell">{formatCents(order.amountPaidCents)}</td>
              <td className="num-cell">{formatCents(order.amountDueCents)}</td>
              <td>{formatDate(order.dueDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
