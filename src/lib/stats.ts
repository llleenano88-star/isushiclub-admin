import { createServiceClient } from "@/lib/supabase/server";

export const TZ = "Europe/Moscow";

export function mskDay(d: Date | string): string {
  return new Date(d).toLocaleDateString("sv-SE", { timeZone: TZ });
}

export function mskHour(d: Date | string): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(
      new Date(d)
    )
  );
}

// Ключи дней "YYYY-MM-DD" за последние n дней, от старого к новому
export function dayKeysBack(n: number): string[] {
  const base = new Date(`${mskDay(new Date())}T12:00:00+03:00`).getTime();
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(mskDay(new Date(base - i * 86400000)));
  return out;
}

export function startOfDayIso(key: string): string {
  return new Date(`${key}T00:00:00+03:00`).toISOString();
}

export function shortDate(key: string): string {
  const [, m, d] = key.split("-");
  return `${d}.${m}`;
}

export function money(n: number): string {
  return `${Math.round(n).toLocaleString("ru-RU")} ₽`;
}

// Допущение: статус отменённого заказа — "cancelled"
export function isValidOrder(o: any): boolean {
  return o.status !== "cancelled";
}

const STATUS_LABELS: Record<string, string> = {
  new: "Новый",
  confirmed: "Подтверждён",
  cooking: "Готовится",
  delivering: "Доставляется",
  done: "Выполнен",
  cancelled: "Отменён",
};

export function statusLabel(s: string): string {
  return STATUS_LABELS[s] ?? s;
}

// Позиции заказов порциями, чтобы не упереться в лимит длины запроса
export async function fetchItems(
  db: ReturnType<typeof createServiceClient>,
  orderIds: (string | number)[]
): Promise<any[]> {
  const out: any[] = [];
  for (let i = 0; i < orderIds.length; i += 150) {
    const chunk = orderIds.slice(i, i + 150);
    const { data } = await db
      .from("order_items")
      .select("order_id, name, qty, price")
      .in("order_id", chunk);
    out.push(...((data ?? []) as any[]));
  }
  return out;
}

export function topDishes(items: any[], limit: number) {
  const map = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const it of items) {
    const name = String(it.name ?? "—");
    const qty = Number(it.qty) || 0;
    const price = Number(it.price) || 0;
    const cur = map.get(name) ?? { name, qty: 0, revenue: 0 };
    cur.qty += qty;
    cur.revenue += qty * price;
    map.set(name, cur);
  }
  return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, limit);
}

// CSV для Excel: разделитель ";" и BOM
export function toCsv(rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "\uFEFF" + rows.map((r) => r.map(esc).join(";")).join("\r\n");
}
