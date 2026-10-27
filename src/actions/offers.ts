"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { uploadImage } from "@/lib/upload";

const KINDS = ["gift_from_amount", "cheapest_free", "combo_gift", "percent", "fixed"] as const;
const strs = (v: unknown, max = 200) => (Array.isArray(v) ? v.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, max) : []);
const nonNeg = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : 0; };

function cleanFilter(f: any) {
  return { categoryIds: strs(f?.categoryIds), productIds: strs(f?.productIds), labelContains: String(f?.labelContains ?? "").trim().slice(0, 40) };
}
function cleanGifts(g: any) {
  return (Array.isArray(g) ? g : []).slice(0, 200).map((x: any) => ({ productId: String(x?.productId ?? "").trim(), label: String(x?.label ?? "").trim(), name: String(x?.name ?? "").trim().slice(0, 120) })).filter((x) => x.productId && x.label);
}

// Приводит настройки акции к безопасному виду и проверяет обязательные поля
function build(d: any): { row?: Record<string, any>; error?: string } {
  const title = String(d?.title ?? "").trim();
  if (!title) return { error: "Укажите название акции" };
  if (!KINDS.includes(d?.kind)) return { error: "Выберите тип акции" };
  const hh = /^([01]\d|2[0-3]):[0-5]\d$/; const dt = /^\d{4}-\d{2}-\d{2}$/;
  const tf = String(d?.time_from ?? ""); const tt = String(d?.time_to ?? "");
  if ((tf && !hh.test(tf)) || (tt && !hh.test(tt))) return { error: "Время указано неверно (пример: 10:00)" };
  const sa = String(d?.starts_at ?? ""); const ea = String(d?.ends_at ?? "");
  if ((sa && !dt.test(sa)) || (ea && !dt.test(ea))) return { error: "Дата указана неверно" };
  if (sa && ea && sa > ea) return { error: "Дата начала позже даты окончания" };
  const weekdays = (Array.isArray(d?.weekdays) ? d.weekdays : []).map(Number).filter((n: number) => Number.isInteger(n) && n >= 1 && n <= 7);
  const receive = ["any", "delivery", "pickup"].includes(d?.receive_type) ? d.receive_type : "any";
  const c = d?.config ?? {}; let config: Record<string, any> = {};
  switch (d.kind) {
    case "gift_from_amount": {
      const gifts = cleanGifts(c.gifts); if (!gifts.length) return { error: "Выберите хотя бы один подарок" };
      config = { minSubtotal: nonNeg(c.minSubtotal), filter: cleanFilter(c.filter), gifts }; if (!config.minSubtotal) return { error: "Укажите сумму, от которой дарим подарок" };
      break;
    }
    case "cheapest_free": {
      const buy = Math.floor(nonNeg(c.buy)); const free = Math.floor(nonNeg(c.free));
      if (buy < 1 || free < 1) return { error: "Укажите, сколько штук покупают и сколько дарят (минимум по 1)" };
      config = { buy, free, filter: cleanFilter(c.filter) };
      break;
    }
    case "combo_gift": {
      const qty = Math.floor(nonNeg(c.qty)); const gifts = cleanGifts(c.gifts);
      if (qty < 1) return { error: "Укажите, сколько штук нужно купить" };
      if (!gifts.length) return { error: "Выберите хотя бы один подарок" };
      config = { qty, repeat: !!c.repeat, filter: cleanFilter(c.filter), gifts };
      break;
    }
    case "percent": {
      const value = nonNeg(c.value); if (value < 1 || value > 100) return { error: "Скидка в процентах: от 1 до 100" };
      config = { value, minSubtotal: nonNeg(c.minSubtotal), filter: cleanFilter(c.filter) };
      break;
    }
    case "fixed": {
      const value = nonNeg(c.value); if (value < 1) return { error: "Укажите сумму скидки" };
      config = { value, minSubtotal: nonNeg(c.minSubtotal), filter: cleanFilter(c.filter) };
      break;
    }
  }
  return { row: { title, description: String(d?.description ?? "").trim().slice(0, 1500), kind: d.kind, config, time_from: tf || null, time_to: tt || null, weekdays: weekdays.length ? weekdays : null, starts_at: sa || null, ends_at: ea || null, receive_type: receive, is_active: !!d?.is_active, sort_order: Number(d?.sort_order) || 0 } };
}

export async function savePromotion(id: string | null, fd: FormData) {
  await requireAdmin();
  let d: any; try { d = JSON.parse(String(fd.get("data") ?? "{}")); } catch { return { ok: false as const, error: "Ошибка данных формы" }; }
  const b = build(d); if (!b.row) return { ok: false as const, error: b.error ?? "Ошибка" };
  const file = fd.get("image");
  if (file instanceof File && file.size > 0) {
    const up = await uploadImage(file, "promos");
    if (!up.ok) return { ok: false as const, error: up.error };
    b.row.image_url = up.url;
  } else if (fd.get("remove_image") === "1") b.row.image_url = null;
  const db = createServiceClient();
  const { error } = id ? await db.from("promotions").update(b.row).eq("id", id) : await db.from("promotions").insert(b.row);
  if (error) return { ok: false as const, error: error.code === "42P01" ? "Сначала выполните миграцию 011 в Supabase" : error.message };
  revalidatePath("/offers");
  return { ok: true as const };
}

export async function togglePromotion(id: string, value: boolean) {
  await requireAdmin();
  const { error } = await createServiceClient().from("promotions").update({ is_active: value }).eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/offers");
  return { ok: true as const };
}

export async function deletePromotion(id: string) {
  await requireAdmin();
  const { error } = await createServiceClient().from("promotions").delete().eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/offers");
  return { ok: true as const };
}
