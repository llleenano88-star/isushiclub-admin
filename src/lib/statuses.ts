// ВНИМАНИЕ: сверьте значения со статусами, которые реально пишет сайт в orders.status.
export const ORDER_STATUSES = [
  { value: "new", label: "Новый", color: "bg-blue-100 text-blue-700" },
  { value: "confirmed", label: "Подтверждён", color: "bg-indigo-100 text-indigo-700" },
  { value: "cooking", label: "Готовится", color: "bg-amber-100 text-amber-700" },
  { value: "delivering", label: "В доставке", color: "bg-purple-100 text-purple-700" },
  { value: "done", label: "Выполнен", color: "bg-emerald-100 text-emerald-700" },
  { value: "cancelled", label: "Отменён", color: "bg-slate-200 text-slate-600" },
];

export const statusLabel = (v: string) => ORDER_STATUSES.find((s) => s.value === v)?.label ?? v;
export const statusColor = (v: string) => ORDER_STATUSES.find((s) => s.value === v)?.color ?? "bg-slate-100 text-slate-600";

// ВНИМАНИЕ: сверьте со значениями orders.receive_type
export const receiveLabel = (v: string | null) =>
  v === "delivery" ? "Доставка" : v === "pickup" ? "Самовывоз" : v || "—";
