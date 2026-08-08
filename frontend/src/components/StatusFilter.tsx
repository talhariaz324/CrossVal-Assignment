import type { OrderStatus } from "../api/types";

const OPTIONS: { value: OrderStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "partially_paid", label: "Partially paid" },
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
    <select
      aria-label="Filter by status"
      value={value}
      onChange={(e) => onChange(e.target.value as OrderStatus | "")}
    >
      {OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
