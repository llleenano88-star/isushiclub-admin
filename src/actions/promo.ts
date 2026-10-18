"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

// Допущение: значения promo_codes.discount_type в базе.
// Если у сайта другие — поправьте здесь и в PromoTable.tsx (PROMO_TYPES).
const PROMO_TYPE_VALUES = ["percent", "fixed", "free_delivery"] as const;

export type PromoInput = {
  code: string;
  discount_type: string;
  discount_value: number;
  min_order: number;
  expires_at: string | null; // "YYYY-MM-DD" или null (бессрочно)
  max_uses: number | null; // null — без лимита
  active: boolean;
};

function normalize(input: PromoInput) {
  return { ...input, code: input.code.trim().toUpperCase() };
}

function validate(input: PromoInput): string | null {
  if (!input.code) return "Укажите код промокода";
  if (!/^[A-Z0-9_-]+$/.test(input.code)) {
    return "Код: только латинские буквы, цифры, дефис и подчёркивание";
  }
  if (!(PROMO_TYPE_VALUES as readonly string[]).includes(input.discount_type)) {
    return "Выберите тип скидки";
  }
  if (input.discount_type === "percent") {
    if (!(input.discount_value > 0 && input.discount_value <= 100)) {
      return "Процент скидки должен быть от 1 до 100";
    }
  }
  if (input.discount_type === "fixed" && !(input.discount_value > 0)) {
    return "Сумма скидки должна быть больше нуля";
  }
  if (!Number.isFinite(input.min_order) || input.min_order < 0) {
    return "Минимальная сумма не может быть отрицательной";
  }
  if (input.max_uses !== null && !(Number.isInteger(input.max_uses) && input.max_uses > 0)) {
    return "Лимит использований должен быть целым числом больше нуля";
  }
  if (input.expires_at !== null && !/^\d{4}-\d{2}-\d{2}$/.test(input.expires_at)) {
    return "Некорректная дата окончания";
  }
  return null;
}

function toRow(input: PromoInput) {
  return {
    code: input.code,
    discount_type: input.discount_type,
    discount_value: input.discount_type === "free_delivery" ? 0 : input.discount_value,
    min_order: input.min_order,
    // конец выбранного дня по московскому времени
    expires_at: input.expires_at ? `${input.expires_at}T23:59:59+03:00` : null,
    max_uses: input.max_uses,
    active: input.active,
  };
}

async function codeTaken(code: string, exceptId?: string | number) {
  let q = createServiceClient().from("promo_codes").select("id").eq("code", code).limit(1);
  if (exceptId !== undefined) q = q.neq("id", exceptId);
  const { data } = await q;
  return (data ?? []).length > 0;
}

export async function createPromo(raw: PromoInput) {
  await requireAdmin();
  const input = normalize(raw);
  const err = validate(input);
  if (err) return { ok: false as const, error: err };
  if (await codeTaken(input.code)) {
    return { ok: false as const, error: "Промокод с таким кодом уже существует" };
  }

  const { error } = await createServiceClient()
    .from("promo_codes")
    .insert({ ...toRow(input), uses_count: 0 });
  if (error) {
    return {
      ok: false as const,
      error: error.code === "23505" ? "Промокод с таким кодом уже существует" : error.message,
    };
  }

  revalidatePath("/promo");
  return { ok: true as const };
}

export async function updatePromo(id: string | number, raw: PromoInput) {
  await requireAdmin();
  const input = normalize(raw);
  const err = validate(input);
  if (err) return { ok: false as const, error: err };
  if (await codeTaken(input.code, id)) {
    return { ok: false as const, error: "Промокод с таким кодом уже существует" };
  }

  const { error } = await createServiceClient().from("promo_codes").update(toRow(input)).eq("id", id);
  if (error) {
    return {
      ok: false as const,
      error: error.code === "23505" ? "Промокод с таким кодом уже существует" : error.message,
    };
  }

  revalidatePath("/promo");
  return { ok: true as const };
}

export async function togglePromo(id: string | number, active: boolean) {
  await requireAdmin();
  const { error } = await createServiceClient().from("promo_codes").update({ active }).eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/promo");
  return { ok: true as const };
}

export async function deletePromo(id: string | number) {
  await requireAdmin();
  const { error } = await createServiceClient().from("promo_codes").delete().eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/promo");
  return { ok: true as const };
}
