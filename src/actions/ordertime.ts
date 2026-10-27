"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

export type OrderTimeInput = {
  pickup_lead_min: number; pickup_lead_max: number; delivery_lead_min: number; delivery_lead_max: number;
  slot_step: number; work_from: string; work_to: string; site_tz: string; zone_text: string;
};

// Время заказа (минимальный срок для самовывоза и доставки, шаг, часы работы) и текст над картой зон
export async function updateOrderTimeSettings(input: OrderTimeInput) {
  await requireAdmin();
  const nums: [keyof OrderTimeInput, string][] = [
    ["pickup_lead_min", "Самовывоз: от"], ["pickup_lead_max", "Самовывоз: до"], ["delivery_lead_min", "Доставка: от"], ["delivery_lead_max", "Доставка: до"],
  ];
  for (const [k, label] of nums) {
    const v = Number(input[k]);
    if (!Number.isFinite(v) || v < 0 || v > 600) return { ok: false as const, error: `${label}: укажите минуты от 0 до 600` };
  }
  if (input.pickup_lead_min > input.pickup_lead_max) return { ok: false as const, error: "Самовывоз: «от» не может быть больше «до»" };
  if (input.delivery_lead_min > input.delivery_lead_max) return { ok: false as const, error: "Доставка: «от» не может быть больше «до»" };
  if (![5, 10, 15, 20, 30].includes(Number(input.slot_step))) return { ok: false as const, error: "Шаг времени: 5, 10, 15, 20 или 30 минут" };
  const hh = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (input.work_from && !hh.test(input.work_from)) return { ok: false as const, error: "Часы работы: формат 10:00" };
  if (input.work_to && !hh.test(input.work_to)) return { ok: false as const, error: "Часы работы: формат 22:00" };
  const tz = input.site_tz.trim() || "Europe/Samara";
  try { new Intl.DateTimeFormat("ru", { timeZone: tz }); } catch { return { ok: false as const, error: "Часовой пояс указан неверно (пример: Europe/Samara)" }; }

  const { error } = await createServiceClient().from("site_settings").upsert(
    [
      { key: "pickup_lead_min", value: Number(input.pickup_lead_min) }, { key: "pickup_lead_max", value: Number(input.pickup_lead_max) },
      { key: "delivery_lead_min", value: Number(input.delivery_lead_min) }, { key: "delivery_lead_max", value: Number(input.delivery_lead_max) },
      { key: "slot_step", value: Number(input.slot_step) }, { key: "work_from", value: input.work_from }, { key: "work_to", value: input.work_to },
      { key: "site_tz", value: tz }, { key: "zone_text", value: input.zone_text.trim().slice(0, 300) },
    ],
    { onConflict: "key" }
  );
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/delivery");
  return { ok: true as const };
}
