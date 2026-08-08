import { useParams } from "react-router-dom";
import { useOrder } from "../api/hooks/useOrder";
import { StatusBadge } from "../components/StatusBadge";
import { PaymentHistoryTable } from "../components/PaymentHistoryTable";
import { PaymentForm } from "../components/PaymentForm";
import { formatCents } from "../lib/money";

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: order, isLoading, error } = useOrder(id);

  if (isLoading) return <div className="page">Loading…</div>;
  if (error || !order) return <div className="page">Order not found.</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>{order.customerName}</h1>
        <StatusBadge status={order.status} />
      </div>

      <dl className="order-summary">
        <div>
          <dt>Due date</dt>
          <dd>{order.dueDate}</dd>
        </div>
        <div>
          <dt>Order total</dt>
          <dd>{formatCents(order.orderTotalCents)}</dd>
        </div>
        <div>
          <dt>Amount paid</dt>
          <dd>{formatCents(order.amountPaidCents)}</dd>
        </div>
        <div>
          <dt>Amount due</dt>
          <dd data-testid="amount-due">{formatCents(order.amountDueCents)}</dd>
        </div>
      </dl>

      <h2>Line items</h2>
      <table className="line-item-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Qty</th>
            <th>Unit price</th>
            <th>Line total</th>
          </tr>
        </thead>
        <tbody>
          {order.lineItems.map((item) => (
            <tr key={item.id}>
              <td>{item.description}</td>
              <td>{item.quantity}</td>
              <td>{formatCents(item.unitPriceCents)}</td>
              <td>{formatCents(item.quantity * item.unitPriceCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!order.editable && (
        <p className="hint">
          This order has payments recorded, so its line items and due date are locked (read-only).
        </p>
      )}

      <h2>Payment history</h2>
      <PaymentHistoryTable payments={order.payments} />

      {order.amountDueCents > 0 && <PaymentForm orderId={order.id} />}
    </div>
  );
}
