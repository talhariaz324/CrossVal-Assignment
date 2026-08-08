import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import type { OrderDetail } from "../types";

export interface CreateOrderPayload {
  customerName: string;
  dueDate: string;
  lineItems: { description: string; quantity: number; unitPrice: number }[];
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateOrderPayload) => api.post<OrderDetail>("/orders", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}
