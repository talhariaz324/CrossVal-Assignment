import type { OrderStatus } from "../api/types";

const LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  partially_paid: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`status-badge status-badge--${status}`} data-testid="status-badge">
      {LABELS[status]}
    </span>
  );
}
