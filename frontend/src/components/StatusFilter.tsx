import type { OrderStatus } from "../api/types";

const OPTIONS: { value: OrderStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "partially_paid", label: "Partial" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
];

export function StatusFilter({
  value,
  onChange,
}: {
  value: OrderStatus | "";
  onChange: (value: OrderStatus | "") => void;
}) {
  return (
    <div className="segmented" role="group" aria-label="Filter by status">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
