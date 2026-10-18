import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { LineChart } from "@/components/LineChart";
import {
  dayKeysBack,
  fetchItems,
  isValidOrder,
  mskDay,
  money,
  shortDate,
  startOfDayIso,
  statusLabel,
  topDishes,
} from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireAdmin();
  const db = createServiceClient();

  const days = dayKeysBack(7);
  const today = days[days.length - 1];

  const { data, error } = await db
    .from("orders")
    .select("id, number, status, total, customer_name, created_at, iiko_order_id")
    .gte("created_at", startOfDayIso(days[0]))
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-semibold text-slate-800">Дашборд</h1>
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          Не удалось загрузить данные: {error.message}
        </div>
      </div>
    );
  }

  const orders = (data ?? []) as any[];
  const valid = orders.filter(isValidOrder);

  const todayOrders = valid.filter((o) => mskDay(o.created_at) === today);
  const sum = (list: any[]) => list.reduce((s, o) => s + (Number(o.total) || 0), 0);

  const byDay = new Map<string, number>(days.map((d) => [d, 0]));
  for (const o of valid) {
    const k = mskDay(o.created_at);
    byDay.set(k, (byDay.get(k) ?? 0) + 1);
  }
  const points = days.map((d) => ({ label: shortDate(d), value: byDay.get(d) ?? 0 }));

  const items = await fetchItems(
    db,
    valid.map((o) => o.id)
  );
  const top = topDishes(items, 5);

  // Допущения: «новый» заказ = status "new"; заказ не ушёл в iiko, если iiko_order_id пуст
  const newCount = orders.filter((o) => o.status === "new").length;
  const notInIiko = valid.filter((o) => !o.iiko_order_id);

  const last10 = orders.slice(0, 10);
  const card = "rounded-lg border border-slate-200 bg-white p-5";

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-slate-800">Дашборд</h1>

      <div className="mb-5 grid grid-cols-3 gap-4">
        <div className={card}>
          <div className="text-sm text-slate-500">Заказы сегодня</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{todayOrders.length}</div>
          <div className="text-sm text-slate-600">{money(sum(todayOrders))}</div>
        </div>
        <div className={card}>
          <div className="text-sm text-slate-500">Заказы за 7 дней</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{valid.length}</div>
          <div className="text-sm text-slate-600">{money(sum(valid))}</div>
        </div>
        <div className={card}>
          <div className="text-sm text-slate-500">Средний чек (7 дней)</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">
            {valid.length ? money(sum(valid) / valid.length) : "—"}
          </div>
        </div>
      </div>

      <div className={`${card} mb-5`}>
        <h2 className="mb-3 text-base font-semibold text-slate-800">Заказы за 7 дней</h2>
        <LineChart points={points} />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-4">
        <div className={card}>
          <h2 className="mb-3 text-base font-semibold text-slate-800">Топ-5 блюд (7 дней)</h2>
          {top.length === 0 ? (
            <p className="text-sm text-slate-500">Нет данных</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {top.map((d, i) => (
                <li key={d.name} className="flex items-center justify-between gap-3">
                  <span className="text-slate-900">
                    <span className="mr-2 text-slate-400">{i + 1}.</span>
                    {d.name}
                  </span>
                  <span className="whitespace-nowrap text-slate-600">{d.qty} шт.</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className={card}>
          <h2 className="mb-3 text-base font-semibold text-slate-800">Уведомления</h2>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between">
              <span className="text-slate-700">Новые заказы</span>
              <span className={`badge ${newCount ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                {newCount}
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-slate-700">Заказы не в iiko</span>
              <span className={`badge ${notInIiko.length ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                {notInIiko.length}
              </span>
            </li>
          </ul>
          {notInIiko.length > 0 && (
            <p className="mt-3 text-xs text-slate-500">
              Номера: {notInIiko.slice(0, 8).map((o) => `№${o.number ?? o.id}`).join(", ")}
              {notInIiko.length > 8 ? "…" : ""}
            </p>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-3 text-base font-semibold text-slate-800">
          Последние заказы
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="th">№</th>
              <th className="th">Клиент</th>
              <th className="th">Сумма</th>
              <th className="th">Статус</th>
              <th className="th">Создан</th>
            </tr>
          </thead>
          <tbody>
            {last10.length === 0 && (
              <tr>
                <td colSpan={5} className="td py-6 text-center text-slate-500">
                  Заказов за последние 7 дней нет
                </td>
              </tr>
            )}
            {last10.map((o) => (
              <tr key={String(o.id)} className="hover:bg-slate-50">
                <td className="td font-medium text-slate-900">{o.number ?? o.id}</td>
                <td className="td text-slate-700">{o.customer_name || "—"}</td>
                <td className="td text-slate-900">{money(Number(o.total) || 0)}</td>
                <td className="td">
                  <span className="badge bg-slate-100 text-slate-700">{statusLabel(String(o.status))}</span>
                </td>
                <td className="td text-slate-600">
                  {new Date(o.created_at).toLocaleString("ru-RU", {
                    timeZone: "Europe/Moscow",
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
