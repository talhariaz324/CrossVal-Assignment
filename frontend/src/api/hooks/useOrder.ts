import { useQuery } from "@tanstack/react-query";
import { api } from "../client";
import type { OrderDetail } from "../types";

export function useOrder(orderId: string | undefined) {
  return useQuery({
    queryKey: ["order", orderId] as const,
    queryFn: () => api.get<OrderDetail>(`/orders/${orderId}`),
    enabled: !!orderId,
  });
}
