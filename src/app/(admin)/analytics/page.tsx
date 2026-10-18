import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { LineChart } from "@/components/LineChart";
import {
  dayKeysBack,
  fetchItems,
  isValidOrder,
  mskDay,
  mskHour,
  money,
  shortDate,
  startOfDayIso,
  toCsv,
  topDishes,
} from "@/lib/stats";
import { CsvButton } from "./CsvButton";

export const dynamic = "force-dynamic";

const PERIODS = [
  { key: "day", label: "День", days: 1 },
  { key: "week", label: "Неделя", days: 7 },
  { key: "month", label: "Месяц", days: 30 },
] as const;

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const period = PERIODS.find((p) => p.key === sp.period) ?? PERIODS[1];

  const db = createServiceClient();
  const days = dayKeysBack(period.days);

  const { data, error } = await db
    .from("orders")
    .select("id, number, status, total, customer_name, phone, created_at")
    .gte("created_at", startOfDayIso(days[0]))
    .order("created_at", { ascending: false })
    .limit(5000);

  const tabs = (
    <div className="mb-4 flex items-center justify-between">
      <div className="inline-flex overflow-hidden rounded-lg border border-slate-300 bg-white">
        {PERIODS.map((p) => (
          <Link
            key={p.key}
            href={`/analytics?period=${p.key}`}
            className={`px-4 py-2 text-sm font-medium ${
              p.key === period.key ? "bg-emerald-600 text-white" : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>
    </div>
  );

  if (error) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-semibold text-slate-800">Аналитика</h1>
        {tabs}
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          Не удалось загрузить данные: {error.message}
        </div>
      </div>
    );
  }

  const valid = ((data ?? []) as any[]).filter(isValidOrder);
  const revenue = valid.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const avg = valid.length ? revenue / valid.length : 0;

  // График: за день — по часам, за неделю и месяц — по дням
  let points: { label: string; value: number }[];
  if (period.key === "day") {
    const byHour = new Array<number>(24).fill(0);
    for (const o of valid) byHour[mskHour(o.created_at)] += Number(o.total) || 0;
    points = byHour.map((v, h) => ({ label: String(h).padStart(2, "0"), value: v }));
  } else {
    const byDay = new Map<string, number>(days.map((d) => [d, 0]));
    for (const o of valid) {
      const k = mskDay(o.created_at);
      byDay.set(k, (byDay.get(k) ?? 0) + (Number(o.total) || 0));
    }
    points = days.map((d) => ({ label: shortDate(d), value: byDay.get(d) ?? 0 }));
  }

  const items = await fetchItems(
    db,
    valid.map((o) => o.id)
  );
  const dishes = topDishes(items, 10);

  // Клиенты — по телефону (если нет, по имени)
  const clientMap = new Map<string, { name: string; phone: string; orders: number; sum: number }>();
  for (const o of valid) {
    const key = String(o.phone || o.customer_name || "—");
    const cur = clientMap.get(key) ?? {
      name: String(o.customer_name || "—"),
      phone: String(o.phone || ""),
      orders: 0,
      sum: 0,
    };
    cur.orders += 1;
    cur.sum += Number(o.total) || 0;
    clientMap.set(key, cur);
  }
  const clients = [...clientMap.values()].sort((a, b) => b.sum - a.sum).slice(0, 10);

  const csv = toCsv([
    ["Период", period.label, `${days[0]} — ${days[days.length - 1]}`],
    ["Заказов", valid.length],
    ["Выручка, ₽", Math.round(revenue)],
    ["Средний чек, ₽", Math.round(avg)],
    [],
    [period.key === "day" ? "Час" : "Дата", "Выручка, ₽"],
    ...points.map((p) => [p.label, Math.round(p.value)]),
    [],
    ["Топ блюд", "Количество", "Сумма, ₽"],
    ...dishes.map((d) => [d.name, d.qty, Math.round(d.revenue)]),
    [],
    ["Топ клиентов", "Телефон", "Заказов", "Сумма, ₽"],
    ...clients.map((c) => [c.name, c.phone, c.orders, Math.round(c.sum)]),
  ]);

  const card = "rounded-lg border border-slate-200 bg-white p-5";

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Аналитика</h1>
        <CsvButton csv={csv} filename={`analytics-${period.key}-${days[days.length - 1]}.csv`} />
      </div>
      {tabs}

      <div className="mb-5 grid grid-cols-3 gap-4">
        <div className={card}>
          <div className="text-sm text-slate-500">Выручка</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{money(revenue)}</div>
        </div>
        <div className={card}>
          <div className="text-sm text-slate-500">Заказов</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{valid.length}</div>
        </div>
        <div className={card}>
          <div className="text-sm text-slate-500">Средний чек</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{valid.length ? money(avg) : "—"}</div>
        </div>
      </div>

      <div className={`${card} mb-5`}>
        <h2 className="mb-3 text-base font-semibold text-slate-800">Выручка</h2>
        <LineChart points={points} formatValue={money} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-3 text-base font-semibold text-slate-800">
            Топ-10 блюд
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="th">Блюдо</th>
                <th className="th text-right">Кол-во</th>
                <th className="th text-right">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {dishes.length === 0 && (
                <tr>
                  <td colSpan={3} className="td py-6 text-center text-slate-500">
                    Нет данных
                  </td>
                </tr>
              )}
              {dishes.map((d) => (
                <tr key={d.name}>
                  <td className="td text-slate-900">{d.name}</td>
                  <td className="td text-right text-slate-700">{d.qty}</td>
                  <td className="td text-right text-slate-700">{money(d.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-3 text-base font-semibold text-slate-800">
            Топ-10 клиентов
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="th">Клиент</th>
                <th className="th text-right">Заказов</th>
                <th className="th text-right">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 && (
                <tr>
                  <td colSpan={3} className="td py-6 text-center text-slate-500">
                    Нет данных
                  </td>
                </tr>
              )}
              {clients.map((c, i) => (
                <tr key={`${c.phone}-${i}`}>
                  <td className="td text-slate-900">
                    {c.name}
                    {c.phone && <div className="text-xs text-slate-500">{c.phone}</div>}
                  </td>
                  <td className="td text-right text-slate-700">{c.orders}</td>
                  <td className="td text-right text-slate-700">{money(c.sum)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
