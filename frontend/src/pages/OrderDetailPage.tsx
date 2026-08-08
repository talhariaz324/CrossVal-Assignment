import { useParams } from "react-router-dom";
import { useOrder } from "../api/hooks/useOrder";
import { StatusBadge } from "../components/StatusBadge";
import { PaymentHistoryTable } from "../components/PaymentHistoryTable";
import { PaymentForm } from "../components/PaymentForm";
import { Card } from "../components/Card";
import { SkeletonRows } from "../components/Skeleton";
import { formatCents } from "../lib/money";
import { formatDate } from "../lib/date";

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: order, isLoading, error } = useOrder(id);

  if (isLoading) {
    return (
      <div className="page">
        <Card>
          <SkeletonRows rows={5} />
        </Card>
      </div>
    );
  }
  if (error || !order) return <div className="page">Order not found.</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>{order.customerName}</h1>
        <StatusBadge status={order.status} />
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Due date</div>
          <div className="stat-value">{formatDate(order.dueDate)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Order total</div>
          <div className="stat-value">{formatCents(order.orderTotalCents)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Amount paid</div>
          <div className="stat-value">{formatCents(order.amountPaidCents)}</div>
        </div>
        <div className={`stat-card${order.amountDueCents > 0 ? " stat-card--accent" : ""}`}>
          <div className="stat-label">Amount due</div>
          <div className="stat-value" data-testid="amount-due">
            {formatCents(order.amountDueCents)}
          </div>
        </div>
      </div>

      <h2 className="section-label">Line items</h2>
      <Card className="card--table">
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th className="num-cell">Qty</th>
              <th className="num-cell">Unit price</th>
              <th className="num-cell">Line total</th>
            </tr>
          </thead>
          <tbody>
            {order.lineItems.map((item) => (
              <tr key={item.id}>
                <td>{item.description}</td>
                <td className="num-cell">{item.quantity}</td>
                <td className="num-cell">{formatCents(item.unitPriceCents)}</td>
                <td className="num-cell">{formatCents(item.quantity * item.unitPriceCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {!order.editable && (
        <p className="hint" style={{ marginTop: 12 }}>
          This order has payments recorded, so its line items and due date are locked (read-only).
        </p>
      )}

      <h2 className="section-label">Payment history</h2>
      <PaymentHistoryTable payments={order.payments} />

      {order.amountDueCents > 0 && <PaymentForm orderId={order.id} />}
    </div>
  );
}
