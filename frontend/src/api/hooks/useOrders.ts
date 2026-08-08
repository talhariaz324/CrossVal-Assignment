import { useQuery } from "@tanstack/react-query";
import { api } from "../client";
import type { OrderStatus, OrderSummary } from "../types";

export function useOrders(status?: OrderStatus) {
  return useQuery({
    queryKey: ["orders", { status }] as const,
    queryFn: () =>
      api.get<{ orders: OrderSummary[] }>(`/orders${status ? `?status=${status}` : ""}`).then((r) => r.orders),
  });
}
