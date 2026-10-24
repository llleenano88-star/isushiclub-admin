"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/Toast";
import { updateDeliverySettings } from "@/actions/settings";

type Values = { delivery_price: number; free_delivery_from: number; min_order: number; delivery_iiko_id: string };

export function DeliveryForm({ initial }: { initial: Values }) {
  // Допущение: useToast() возвращает функцию toast(msg, "error"?)
  const toast = useToast();
  const [form, setForm] = useState({
    delivery_price: String(initial.delivery_price),
    free_delivery_from: String(initial.free_delivery_from),
    min_order: String(initial.min_order),
    delivery_iiko_id: initial.delivery_iiko_id,
  });
  const [pending, startTransition] = useTransition();

  function save() {
    const payload: Values = {
      delivery_price: Number(form.delivery_price.trim() || "0"),
      free_delivery_from: Number(form.free_delivery_from.trim() || "0"),
      min_order: Number(form.min_order.trim() || "0"),
      delivery_iiko_id: form.delivery_iiko_id.trim(),
    };
    startTransition(async () => {
      const res = await updateDeliverySettings(payload);
      if (!res.ok) toast(res.error, "error");
      else toast("Сохранено");
    });
  }

  const field = (key: "delivery_price" | "free_delivery_from" | "min_order", label: string) => (
    <label className="block text-sm">
      <span className="label">{label}</span>
      <div className="relative">
        <input
          type="number"
          min={0}
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          className="input w-full pr-8"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
          ₽
        </span>
      </div>
    </label>
  );

  return (
    <div className="max-w-xl rounded-lg border border-slate-200 bg-white p-5">
      <div className="space-y-4">
        {field("delivery_price", "Стоимость доставки")}
        {field("free_delivery_from", "Бесплатная доставка от суммы")}
        {field("min_order", "Минимальная сумма заказа")}
        <label className="block text-sm">
          <span className="label">Код доставки в iiko</span>
          <input
            type="text"
            value={form.delivery_iiko_id}
            onChange={(e) => setForm((f) => ({ ...f, delivery_iiko_id: e.target.value }))}
            placeholder="ID позиции «Доставка» из iiko"
            className="input w-full"
          />
          <span className="mt-1 block text-xs text-slate-500">
            Если заполнено, платная доставка уходит в iiko отдельной позицией с этим кодом и суммой доставки. При бесплатной доставке позиция не добавляется. Пусто — доставка только в комментарии заказа.
          </span>
        </label>
      </div>
      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="btn btn-primary disabled:opacity-50"
        >
          {pending ? "Сохранение…" : "Сохранить"}
        </button>
      </div>
    </div>
  );
}
