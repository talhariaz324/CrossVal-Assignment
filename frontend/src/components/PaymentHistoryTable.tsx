import type { Payment } from "../api/types";
import { formatCents } from "../lib/money";

export function PaymentHistoryTable({ payments }: { payments: Payment[] }) {
  if (payments.length === 0) {
    return <p className="empty-state">No payments recorded yet.</p>;
  }

  return (
    <table className="payment-table" data-testid="payment-history">
      <thead>
        <tr>
          <th>Date</th>
          <th>Amount</th>
          <th>Note</th>
        </tr>
      </thead>
      <tbody>
        {payments.map((payment) => (
          <tr key={payment.id}>
            <td>{payment.paidOn}</td>
            <td>{formatCents(payment.amountCents)}</td>
            <td>{payment.note ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
