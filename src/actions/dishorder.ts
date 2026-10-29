"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

// Сохраняет порядок блюд одной категории: первому в списке 10, следующему 20 и т.д.
export async function saveProductOrder(ids: string[]) {
  await requireAdmin();
  const list = (Array.isArray(ids) ? ids : []).map(String).filter(Boolean).slice(0, 500);
  if (!list.length) return { ok: false as const, error: "Нет блюд для сохранения" };
  const db = createServiceClient();
  const results = await Promise.all(list.map((id, i) => db.from("products").update({ sort_order: (i + 1) * 10 }).eq("id", id)));
  const bad = results.find((r) => r.error);
  if (bad?.error) return { ok: false as const, error: bad.error.code === "42703" ? "Сначала выполните миграцию 013 в Supabase" : bad.error.message };
  revalidatePath("/dish-order");
  return { ok: true as const };
}
