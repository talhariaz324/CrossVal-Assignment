import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { useCreateOrder } from "../api/hooks/useCreateOrder";

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

export function NewOrderPage() {
  const navigate = useNavigate();
  const createOrder = useCreateOrder();
  const [customerName, setCustomerName] = useState("");
  const [dueDate, setDueDate] = useState(defaultDueDate());
  const [lineItems, setLineItems] = useState<DraftLineItem[]>([emptyLineItem()]);
  const [error, setError] = useState<string | null>(null);

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
      <h1>New order</h1>
      <form onSubmit={handleSubmit} className="order-form">
        <label>
          Customer name
          <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
        </label>
        <label>
          Due date
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
        </label>

        <h2>Line items</h2>
        {lineItems.map((item, index) => (
          <div className="line-item-row" key={index}>
            <input
              placeholder="Description"
              value={item.description}
              onChange={(e) => updateLineItem(index, { description: e.target.value })}
              required
            />
            <input
              type="number"
              min={1}
              step={1}
              placeholder="Qty"
              value={item.quantity}
              onChange={(e) => updateLineItem(index, { quantity: e.target.value })}
              required
            />
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="Unit price"
              value={item.unitPrice}
              onChange={(e) => updateLineItem(index, { unitPrice: e.target.value })}
              required
            />
            <button
              type="button"
              className="link-button"
              onClick={() => removeLineItem(index)}
              disabled={lineItems.length === 1}
              aria-label="Remove line item"
            >
              Remove
            </button>
          </div>
        ))}
        <button type="button" className="link-button" onClick={addLineItem}>
          + Add line item
        </button>

        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}

        <button type="submit" disabled={createOrder.isPending}>
          {createOrder.isPending ? "Creating…" : "Create order"}
        </button>
      </form>
    </div>
  );
}
