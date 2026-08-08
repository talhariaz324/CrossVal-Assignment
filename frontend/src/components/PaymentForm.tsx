import { useState } from "react";
import { ApiError } from "../api/client";
import { useRecordPayment } from "../api/hooks/useRecordPayment";
import { parseDollarsInput } from "../lib/money";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function PaymentForm({ orderId }: { orderId: string }) {
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(todayIso());
  const [note, setNote] = useState("");
  // Generated once per logical submission and reused across retries of that
  // SAME submission (e.g. the mutation's own retry, or the user re-clicking
  // after a network error) so a retry can never create a duplicate payment.
  // Regenerated only after a successful submit, for the next payment.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [formError, setFormError] = useState<string | null>(null);

  const recordPayment = useRecordPayment();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    let amountDollars: number;
    try {
      amountDollars = parseDollarsInput(amount);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Invalid amount");
      return;
    }

    recordPayment.mutate(
      { orderId, amount: amountDollars, paidOn, note: note || undefined, idempotencyKey },
      {
        onSuccess: () => {
          setAmount("");
          setNote("");
          setIdempotencyKey(crypto.randomUUID());
        },
      },
    );
  }

  const apiError = recordPayment.error instanceof ApiError ? recordPayment.error : null;

  return (
    <form onSubmit={handleSubmit} className="payment-form">
      <h3>Record a payment</h3>
      <div className="form-row">
        <label>
          Amount
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </label>
        <label>
          Date
          <input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} required />
        </label>
      </div>
      <label>
        Note (optional)
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
      </label>

      {(formError || apiError) && (
        <p role="alert" className="form-error" data-testid="payment-error">
          {formError ?? apiError?.message}
          {apiError?.code === "OVERPAYMENT" && apiError.details?.maxAllowedCents !== undefined
            ? ` (max: $${((apiError.details.maxAllowedCents as number) / 100).toFixed(2)})`
            : ""}
        </p>
      )}

      <button type="submit" disabled={recordPayment.isPending}>
        {recordPayment.isPending ? "Recording…" : "Record payment"}
      </button>
    </form>
  );
}
