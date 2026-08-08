import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import type { OrderSummary, Payment } from "../types";

export interface RecordPaymentPayload {
  orderId: string;
  amount: number;
  paidOn: string;
  note?: string;
  /** Generated once per form submission by the caller (see PaymentForm) and
   * reused across retries of that same logical submission, so a retry after
   * a dropped response can never create a duplicate payment — the backend
   * enforces this with a unique (order_id, idempotency_key) index. */
  idempotencyKey: string;
}

export function useRecordPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, idempotencyKey, ...body }: RecordPaymentPayload) =>
      api.post<{ order: OrderSummary; payment: Payment }>(`/orders/${orderId}/payments`, body, {
        "Idempotency-Key": idempotencyKey,
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["order", variables.orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}
