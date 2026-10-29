"use client";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { getOrderItems, updateOrderStatus } from "@/actions/orders";
import { ORDER_STATUSES, receiveLabel, statusColor, statusLabel } from "@/lib/statuses";
import { dateTime, downloadCsv, money, sortBy } from "@/lib/utils";

type Order = Record<string, any>;

// Адрес в базе хранится как {text: "..."} (или обычная строка): всегда приводим к тексту, иначе страница падает
function addressText(a: unknown): string {
  if (a == null) return "";
  if (typeof a === "string") return a;
  if (typeof a === "object") {
    const t = (a as Record<string, unknown>).text;
    if (typeof t === "string") return t;
    return Object.values(a as Record<string, unknown>).filter((v) => typeof v === "string" || typeof v === "number").join(", ");
  }
  return String(a);
}
const PAY: Record<string, string> = { cash: "Наличными при получении", transfer: "Переводом при получении", qr: "QR-кодом при получении", card: "Переводом или QR-кодом при получении" };
// Применённые акции и подарки (поле promo_info), безопасно в текст
function promoText(info: unknown): string {
  if (!info || typeof info !== "object") return "";
  const i = info as { discounts?: unknown; gifts?: unknown };
  const d = Array.isArray(i.discounts) ? i.discounts.map((x: any) => `${String(x?.title ?? "Акция")}: −${Number(x?.amount) || 0} ₽`) : [];
  const g = Array.isArray(i.gifts) ? i.gifts.map((x) => `Подарок: ${String(x)}`) : [];
  return [...d, ...g].join("; ");
}
type SortKey = "number" | "created_at" | "customer_name" | "phone" | "total" | "status" | "receive_type" | "promo_code";

const COLS: { key: SortKey; label: string }[] = [
  { key: "number", label: "№" },
  { key: "created_at", label: "Дата" },
  { key: "customer_name", label: "Клиент" },
  { key: "phone", label: "Телефон" },
  { key: "total", label: "Сумма" },
  { key: "status", label: "Статус" },
  { key: "receive_type", label: "Получение" },
  { key: "promo_code", label: "Промокод" },
];

export function OrdersTable({ initial }: { initial: Order[] }) {
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>(initial);
  const [period, setPeriod] = useState<"today" | "week" | "all">("all");
  const [status, setStatus] = useState("");
  const [receive, setReceive] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "created_at", dir: "desc" });
  const [open, setOpen] = useState<Order | null>(null);

  const rows = useMemo(() => {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startWeek = startToday - 6 * 86400000;
    const needle = q.trim().toLowerCase();
    const digits = needle.replace(/\D/g, "");

    const filtered = orders.filter((o) => {
      const t = new Date(o.created_at).getTime();
      if (period === "today" && t < startToday) return false;
      if (period === "week" && t < startWeek) return false;
      if (status && o.status !== status) return false;
      if (receive && o.receive_type !== receive) return false;
      if (needle) {
        const inNumber = String(o.number ?? "").toLowerCase().includes(needle);
        const inName = String(o.customer_name ?? "").toLowerCase().includes(needle);
        const inPhone = digits.length > 0 && String(o.phone ?? "").replace(/\D/g, "").includes(digits);
        if (!inNumber && !inName && !inPhone) return false;
      }
      return true;
    });
    return sortBy(
      filtered,
      (o) => (sort.key === "total" || sort.key === "number" ? Number(o[sort.key]) || 0 : o[sort.key]),
      sort.dir
    );
  }, [orders, period, status, receive, q, sort]);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  async function changeStatus(o: Order, value: string) {
    const prev = o.status;
    setOrders((l) => l.map((x) => (x.id === o.id ? { ...x, status: value } : x)));
    setOpen((cur) => (cur && cur.id === o.id ? { ...cur, status: value } : cur));
    const res = await updateOrderStatus(o.id, value);
    if (res.ok) toast("Статус сохранён");
    else {
      setOrders((l) => l.map((x) => (x.id === o.id ? { ...x, status: prev } : x)));
      toast("Не удалось сохранить: " + res.error, "error");
    }
  }

  function exportCsv() {
    downloadCsv("orders.csv", [
      ["Номер", "Дата", "Клиент", "Телефон", "Сумма", "Скидка", "Статус", "Получение", "Адрес", "Промокод", "Номер в iiko", "Комментарий"],
      ...rows.map((o) => [
        o.number, dateTime(o.created_at), o.customer_name, o.phone, o.total, o.discount,
        statusLabel(o.status), receiveLabel(o.receive_type), addressText(o.address), o.promo_code, o.iiko_order_id, o.comment,
      ]),
    ]);
  }

  const tab = (v: "today" | "week" | "all", label: string) => (
    <button
      onClick={() => setPeriod(v)}
      className={`px-3.5 py-2 text-sm ${period === v ? "bg-emerald-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-md border border-slate-300">
          {tab("today", "Сегодня")}
          {tab("week", "Неделя")}
          {tab("all", "Все")}
        </div>
        <select className="input !w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Все статусы</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select className="input !w-44" value={receive} onChange={(e) => setReceive(e.target.value)}>
          <option value="">Любой способ</option>
          <option value="delivery">Доставка</option>
          <option value="pickup">Самовывоз</option>
        </select>
        <input className="input !w-72" placeholder="Поиск: номер, телефон, имя" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-slate-500">Найдено: {rows.length}</span>
          <button className="btn-secondary" onClick={exportCsv}>Экспорт в CSV</button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full">
          <thead>
            <tr>
              {COLS.map((c) => (
                <th key={c.key} className="th cursor-pointer select-none hover:bg-slate-200" onClick={() => toggleSort(c.key)}>
                  {c.label} {sort.key === c.key ? (sort.dir === "asc" ? "▲" : "▼") : ""}
                </th>
              ))}
              <th className="th">iiko</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setOpen(o)}>
                <td className="td font-medium">{o.number}</td>
                <td className="td whitespace-nowrap">{dateTime(o.created_at)}</td>
                <td className="td">{o.customer_name || "—"}</td>
                <td className="td whitespace-nowrap">{o.phone || "—"}</td>
                <td className="td whitespace-nowrap font-medium">{money(o.total)}</td>
                <td className="td" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={o.status ?? ""}
                    onChange={(e) => changeStatus(o, e.target.value)}
                    className={`rounded border-0 px-2 py-1 text-xs font-medium ${statusColor(o.status)}`}
                  >
                    {!ORDER_STATUSES.some((s) => s.value === o.status) && <option value={o.status ?? ""}>{o.status || "—"}</option>}
                    {ORDER_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </td>
                <td className="td">{receiveLabel(o.receive_type)}</td>
                <td className="td">{o.promo_code || "—"}</td>
                <td className="td">
                  {o.iiko_order_id ? (
                    <span className="badge bg-emerald-100 text-emerald-700">в iiko</span>
                  ) : (
                    <span className="badge bg-red-100 text-red-700">не в iiko</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="td py-10 text-center text-slate-400" colSpan={9}>Заказов по этим условиям нет</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && <OrderModal order={open} onClose={() => setOpen(null)} onStatus={(v) => changeStatus(open, v)} />}
    </div>
  );
}

function OrderModal({ order, onClose, onStatus }: { order: Order; onClose: () => void; onStatus: (v: string) => void }) {
  const [items, setItems] = useState<any[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    getOrderItems(order.id).then((r) => (r.ok ? setItems(r.items) : setErr(r.error)));
  }, [order.id]);

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex gap-3 border-b border-slate-100 py-2 text-sm">
      <div className="w-40 shrink-0 text-slate-500">{label}</div>
      <div className="min-w-0 break-words">{value || "—"}</div>
    </div>
  );

  return (
    <Modal title={`Заказ № ${order.number}`} onClose={onClose} wide>
      <div className="grid gap-x-8 md:grid-cols-2">
        <div>
          {row("Дата", dateTime(order.created_at))}
          {row("Клиент", order.customer_name)}
          {row("Телефон", order.phone)}
          {row("Получение", receiveLabel(order.receive_type))}
          {row("Адрес", addressText(order.address))}
          {order.delivery_zone ? row("Зона доставки", String(order.delivery_zone)) : null}
          {order.desired_time ? row("Ко времени", dateTime(order.desired_time)) : null}
          {order.payment_method ? row("Оплата", PAY[String(order.payment_method)] ?? String(order.payment_method)) : null}
        </div>
        <div>
          {row(
            "Статус",
            <select value={order.status ?? ""} onChange={(e) => onStatus(e.target.value)} className={`rounded px-2 py-1 text-xs font-medium ${statusColor(order.status)}`}>
              {!ORDER_STATUSES.some((s) => s.value === order.status) && <option value={order.status ?? ""}>{order.status || "—"}</option>}
              {ORDER_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          )}
          {row("Промокод", order.promo_code)}
          {promoText(order.promo_info) ? row("Акции", promoText(order.promo_info)) : null}
          {row("Скидка", order.discount ? money(order.discount) : "")}
          {row("Сумма", <b>{money(order.total)}</b>)}
          {row(
            "Номер в iiko",
            order.iiko_order_id ? order.iiko_order_id : <span className="badge bg-red-100 text-red-700">не ушёл на кухню</span>
          )}
        </div>
      </div>
      {order.comment && <div className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900"><b>Комментарий:</b> {order.comment}</div>}

      <h3 className="mb-2 mt-5 text-sm font-semibold text-slate-700">Состав заказа</h3>
      {err ? (
        <div className="text-sm text-red-600">{err}</div>
      ) : !items ? (
        <div className="text-sm text-slate-400">Загрузка…</div>
      ) : (
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Блюдо</th>
              <th className="th">Вариант</th>
              <th className="th">Кол-во</th>
              <th className="th">Цена</th>
              <th className="th">Сумма</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td className="td">{it.name}</td>
                <td className="td">{it.variant_label || "—"}</td>
                <td className="td">{it.qty}</td>
                <td className="td">{money(it.price)}</td>
                <td className="td">{money(Number(it.price) * Number(it.qty))}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td className="td text-slate-400" colSpan={5}>Позиций нет</td></tr>
            )}
          </tbody>
        </table>
      )}
    </Modal>
  );
}
