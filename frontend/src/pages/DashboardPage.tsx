import { useState } from "react";
import { Link } from "react-router-dom";
import { useOrders } from "../api/hooks/useOrders";
import { OrderTable } from "../components/OrderTable";
import { StatusFilter } from "../components/StatusFilter";
import { Card } from "../components/Card";
import { SkeletonRows } from "../components/Skeleton";
import { PlusIcon } from "../components/icons";
import type { OrderStatus } from "../api/types";

export function DashboardPage() {
  const [status, setStatus] = useState<OrderStatus | "">("");
  const { data: orders, isLoading, error } = useOrders(status || undefined);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Orders</h1>
          <p className="page-subtitle">Every order you've created and what's still owed on it.</p>
        </div>
        <Link to="/orders/new" className="btn btn--primary">
          <PlusIcon />
          New order
        </Link>
      </div>

      <div style={{ marginBottom: 16 }}>
        <StatusFilter value={status} onChange={setStatus} />
      </div>

      {isLoading && (
        <Card>
          <SkeletonRows rows={4} />
        </Card>
      )}
      {error && <p className="form-error">Failed to load orders.</p>}
      {orders && <OrderTable orders={orders} />}
    </div>
  );
}
