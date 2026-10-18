"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

export type WorkInput = {
  work_time_from: string; // "HH:MM"
  work_time_to: string; // "HH:MM"
  work_days: number[]; // рабочие дни, 1 = понедельник … 7 = воскресенье
};

export async function updateWorkSettings(input: WorkInput) {
  await requireAdmin();

  const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!timeRe.test(input.work_time_from)) {
    return { ok: false as const, error: "Укажите время открытия" };
  }
  if (!timeRe.test(input.work_time_to)) {
    return { ok: false as const, error: "Укажите время закрытия" };
  }
  const days = [...new Set(input.work_days)].filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);
  days.sort((a, b) => a - b);

  const { error } = await createServiceClient()
    .from("site_settings")
    .upsert(
      [
        { key: "work_time_from", value: input.work_time_from },
        { key: "work_time_to", value: input.work_time_to },
        { key: "work_days", value: days },
      ],
      { onConflict: "key" }
    );
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true as const };
}

// Стоп-лист: is_available = false — товар не показывается на сайте
export async function setProductStop(id: string | number, available: boolean) {
  await requireAdmin();
  const { error } = await createServiceClient()
    .from("products")
    .update({ is_available: available })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/settings");
  revalidatePath("/products");
  revalidatePath("/");
  return { ok: true as const };
}
