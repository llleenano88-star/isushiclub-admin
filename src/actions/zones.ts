"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

export type ZoneInput = {
  name: string; color: string; polygon: [number, number][];
  delivery_price: string; min_order: string; free_from: string; is_active: boolean; sort_order: number;
};

function clean(i: ZoneInput) {
  const name = i.name.trim();
  if (!name) return { error: "Укажите название зоны" };
  if (!/^#[0-9a-fA-F]{6}$/.test(i.color)) return { error: "Цвет указан неверно" };
  const polygon = (Array.isArray(i.polygon) ? i.polygon : []).filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])).map((p) => [Number(p[0]), Number(p[1])]);
  if (polygon.length < 3) return { error: "Нарисуйте зону на карте: нужно минимум 3 точки" };
  const opt = (v: string, label: string): { v: number | null; err?: string } => {
    if (v.trim() === "") return { v: null };
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? { v: n } : { v: null, err: `${label}: укажите число не меньше нуля или оставьте пустым` };
  };
  const price = opt(i.delivery_price, "Цена доставки"); const min = opt(i.min_order, "Минимальный заказ"); const free = opt(i.free_from, "Бесплатно от");
  const err = price.err || min.err || free.err; if (err) return { error: err };
  return { row: { name, color: i.color, polygon, delivery_price: price.v, min_order: min.v, free_from: free.v, is_active: !!i.is_active, sort_order: Number(i.sort_order) || 0 } };
}

export async function saveZone(id: string | null, input: ZoneInput) {
  await requireAdmin();
  const c = clean(input);
  if (!c.row) return { ok: false as const, error: c.error ?? "Ошибка" };
  const db = createServiceClient();
  const { error } = id ? await db.from("delivery_zones").update(c.row).eq("id", id) : await db.from("delivery_zones").insert(c.row);
  if (error) return { ok: false as const, error: error.code === "42P01" ? "Сначала выполните миграцию 011 в Supabase" : error.message };
  revalidatePath("/zones");
  return { ok: true as const };
}

export async function deleteZone(id: string) {
  await requireAdmin();
  const { error } = await createServiceClient().from("delivery_zones").delete().eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/zones");
  return { ok: true as const };
}
