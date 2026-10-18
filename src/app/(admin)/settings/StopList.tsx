"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useToast } from "@/components/Toast";
import { setProductStop } from "@/actions/work";

type Product = { id: string | number; name: string; is_available: boolean };

export function StopList({ products }: { products: Product[] }) {
  // Допущение: useToast() возвращает функцию toast(msg, "error"?)
  const toast = useToast();
  const [items, setItems] = useState<Product[]>(products);
  const [query, setQuery] = useState("");
  const [onlyStopped, setOnlyStopped] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setItems(products);
  }, [products]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (p) => (!q || p.name.toLowerCase().includes(q)) && (!onlyStopped || !p.is_available)
    );
  }, [items, query, onlyStopped]);

  const stopped = items.filter((p) => !p.is_available).length;

  function toggle(p: Product) {
    const next = !p.is_available;
    setItems((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_available: next } : x)));
    startTransition(async () => {
      const res = await setProductStop(p.id, next);
      if (!res.ok) {
        setItems((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_available: p.is_available } : x)));
        toast(res.error, "error");
      } else {
        toast(next ? "Товар возобновлён" : "Товар поставлен в стоп");
      }
    });
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="mb-1 text-base font-semibold text-slate-800">Стоп-лист</h2>
      <p className="mb-4 text-sm text-slate-500">
        Товары в стопе не отображаются на сайте. Сейчас в стопе: {stopped}.
      </p>
      <div className="mb-3 flex items-center gap-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по названию"
          className="input w-80"
        />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={onlyStopped}
            onChange={(e) => setOnlyStopped(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Только в стопе
        </label>
        <span className="text-sm text-slate-500">Найдено: {rows.length}</span>
      </div>
      <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="sticky top-0">
            <tr>
              <th className="th">Название</th>
              <th className="th">Статус</th>
              <th className="th text-right">Действие</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="td py-6 text-center text-slate-500">
                  Ничего не найдено
                </td>
              </tr>
            )}
            {rows.map((p) => (
              <tr key={String(p.id)} className="hover:bg-slate-50">
                <td className="td font-medium text-slate-900">{p.name}</td>
                <td className="td">
                  <span
                    className={`badge ${
                      p.is_available ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                    }`}
                  >
                    {p.is_available ? "в продаже" : "в стопе"}
                  </span>
                </td>
                <td className="td text-right">
                  <button
                    type="button"
                    onClick={() => toggle(p)}
                    disabled={pending}
                    className={`btn ${p.is_available ? "btn-danger" : "btn-secondary"}`}
                  >
                    {p.is_available ? "Стоп" : "Возобновить"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
