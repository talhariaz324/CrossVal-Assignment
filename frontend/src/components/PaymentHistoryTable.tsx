import type { Payment } from "../api/types";
import { formatCents } from "../lib/money";
import { formatDate } from "../lib/date";
import { Card } from "./Card";
import { EmptyState } from "./EmptyState";
import { ReceiptIcon } from "./icons";

export function PaymentHistoryTable({ payments }: { payments: Payment[] }) {
  if (payments.length === 0) {
    return (
      <Card>
        <EmptyState icon={<ReceiptIcon />} title="No payments recorded yet" />
      </Card>
    );
  }

  return (
    <Card className="card--table">
      <table data-testid="payment-history">
        <thead>
          <tr>
            <th>Date</th>
            <th className="num-cell">Amount</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id}>
              <td>{formatDate(payment.paidOn)}</td>
              <td className="num-cell">{formatCents(payment.amountCents)}</td>
              <td style={{ color: payment.note ? undefined : "var(--text-faint)" }}>{payment.note ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
