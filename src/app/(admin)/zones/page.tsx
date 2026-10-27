import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { ZonesManager } from "./ZonesManager";

export const dynamic = "force-dynamic";

export default async function ZonesPage() {
  await requireAdmin();
  const { data, error } = await createServiceClient().from("delivery_zones").select("*").order("sort_order", { ascending: true }).order("name", { ascending: true });
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-slate-800">Зоны доставки</h1>
      <p className="mb-4 text-sm text-slate-500">Нарисуйте на карте, куда вы доставляете. Клиент выбирает зону при заказе. У каждой зоны можно задать свою цену, минимальный заказ и порог бесплатной доставки (пусто = как в разделе «Доставка»). Если зон нет, доставка работает как раньше.</p>
      {error ? (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error.code === "42P01" ? "Таблица зон ещё не создана: выполните миграцию 011 в Supabase." : `Не удалось загрузить зоны: ${error.message}`}
        </div>
      ) : (
        <ZonesManager initial={(data ?? []) as any[]} />
      )}
    </div>
  );
}
