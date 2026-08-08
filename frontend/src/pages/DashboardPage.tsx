import { useState } from "react";
import { useOrders } from "../api/hooks/useOrders";
import { OrderTable } from "../components/OrderTable";
import { StatusFilter } from "../components/StatusFilter";
import type { OrderStatus } from "../api/types";

export function DashboardPage() {
  const [status, setStatus] = useState<OrderStatus | "">("");
  const { data: orders, isLoading, error } = useOrders(status || undefined);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Orders</h1>
        <StatusFilter value={status} onChange={setStatus} />
      </div>
      {isLoading && <p>Loading…</p>}
      {error && <p className="form-error">Failed to load orders.</p>}
      {orders && <OrderTable orders={orders} />}
    </div>
  );
}
