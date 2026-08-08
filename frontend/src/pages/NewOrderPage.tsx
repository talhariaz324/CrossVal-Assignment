import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { useCreateOrder } from "../api/hooks/useCreateOrder";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { PlusIcon, TrashIcon, AlertTriangleIcon } from "../components/icons";
import { formatCents } from "../lib/money";

interface DraftLineItem {
  description: string;
  quantity: string;
  unitPrice: string;
}

function emptyLineItem(): DraftLineItem {
  return { description: "", quantity: "1", unitPrice: "" };
}

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

function lineTotalCents(item: DraftLineItem): number {
  const qty = Number(item.quantity);
  const price = Number(item.unitPrice);
  if (!Number.isFinite(qty) || !Number.isFinite(price)) return 0;
  return Math.round(qty * price * 100);
}

export function NewOrderPage() {
  const navigate = useNavigate();
  const createOrder = useCreateOrder();
  const [customerName, setCustomerName] = useState("");
  const [dueDate, setDueDate] = useState(defaultDueDate());
  const [lineItems, setLineItems] = useState<DraftLineItem[]>([emptyLineItem()]);
  const [error, setError] = useState<string | null>(null);

  const orderTotalCents = lineItems.reduce((sum, item) => sum + lineTotalCents(item), 0);

  function updateLineItem(index: number, patch: Partial<DraftLineItem>) {
    setLineItems((items) => items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addLineItem() {
    setLineItems((items) => [...items, emptyLineItem()]);
  }

  function removeLineItem(index: number) {
    setLineItems((items) => (items.length > 1 ? items.filter((_, i) => i !== index) : items));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedItems = lineItems.map((item) => ({
      description: item.description.trim(),
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
    }));

    try {
      const order = await createOrder.mutateAsync({ customerName, dueDate, lineItems: parsedItems });
      navigate(`/orders/${order.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create order");
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>New order</h1>
      </div>

      <form onSubmit={handleSubmit} className="order-form">
        <Card>
          <div className="form-row">
            <label>
              Customer name
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
            </label>
            <label>
              Due date
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
            </label>
          </div>
        </Card>

        <div>
          <h2 className="section-label">Line items</h2>
          <Card className="line-items-card">
            <div className="line-item-grid-header">
              <span>Description</span>
              <span>Qty</span>
              <span>Unit price</span>
              <span>Line total</span>
              <span />
            </div>
            {lineItems.map((item, index) => (
              <div className="line-item-row" key={index}>
                <input
                  aria-label="Description"
                  placeholder="e.g. Consulting hours"
                  value={item.description}
                  onChange={(e) => updateLineItem(index, { description: e.target.value })}
                  required
                />
                <input
                  aria-label="Qty"
                  type="number"
                  min={1}
                  step={1}
                  value={item.quantity}
                  onChange={(e) => updateLineItem(index, { quantity: e.target.value })}
                  required
                />
                <span className="money-input">
                  <input
                    aria-label="Unit price"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={item.unitPrice}
                    onChange={(e) => updateLineItem(index, { unitPrice: e.target.value })}
                    required
                  />
                </span>
                <span className="line-item-total">{formatCents(lineTotalCents(item))}</span>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => removeLineItem(index)}
                  disabled={lineItems.length === 1}
                  aria-label="Remove line item"
                  title="Remove line item"
                >
                  <TrashIcon width={16} height={16} />
                </button>
              </div>
            ))}

            <div className="order-form-total">
              <span>Order total</span>
              <span className="stat-value">{formatCents(orderTotalCents)}</span>
            </div>
          </Card>
          <div style={{ marginTop: 10 }}>
            <button type="button" className="btn btn--ghost btn--sm" onClick={addLineItem}>
              <PlusIcon width={14} height={14} />
              Add line item
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="form-error">
            <AlertTriangleIcon width={16} height={16} />
            <span>{error}</span>
          </p>
        )}

        <div className="form-actions">
          <Button type="submit" loading={createOrder.isPending}>
            Create order
          </Button>
        </div>
      </form>
    </div>
  );
}
