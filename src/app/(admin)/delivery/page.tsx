import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { DeliveryForm } from "./DeliveryForm";
import { OrderTimeForm } from "./OrderTimeForm";

export const dynamic = "force-dynamic";

// Значение из site_settings может быть числом, строкой или JSON-строкой
function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/"/g, "").trim());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

const toStr = (v: unknown) => (typeof v === "string" ? v.replace(/^"+|"+$/g, "") : "");

export default async function DeliveryPage() {
  await requireAdmin();
  const { data, error } = await createServiceClient()
    .from("site_settings")
    .select("key, value")
    .in("key", ["delivery_price", "free_delivery_from", "min_order", "delivery_iiko_id", "pickup_lead_min", "pickup_lead_max", "delivery_lead_min", "delivery_lead_max", "slot_step", "work_from", "work_to", "site_tz", "zone_text", "close_cutoff_min", "site_city"]);

  const map: Record<string, unknown> = {};
  for (const row of (data ?? []) as any[]) map[row.key] = row.value;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-slate-800">Доставка</h1>
      {error ? (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          Не удалось загрузить настройки: {error.message}
        </div>
      ) : (
        <DeliveryForm
          initial={{
            delivery_price: toNum(map.delivery_price),
            free_delivery_from: toNum(map.free_delivery_from),
            min_order: toNum(map.min_order),
            delivery_iiko_id: typeof map.delivery_iiko_id === "string" ? map.delivery_iiko_id.replace(/^"+|"+$/g, "").trim() : "",
          }}
        />
      )}
      {!error && (
        <OrderTimeForm
          initial={{
            pickup_lead_min: toNum(map.pickup_lead_min) || 30, pickup_lead_max: toNum(map.pickup_lead_max) || 40,
            delivery_lead_min: toNum(map.delivery_lead_min) || 60, delivery_lead_max: toNum(map.delivery_lead_max) || 90,
            slot_step: toNum(map.slot_step) || 10, work_from: toStr(map.work_from), work_to: toStr(map.work_to),
            site_tz: toStr(map.site_tz) || "Europe/Samara", close_cutoff_min: toNum(map.close_cutoff_min), site_city: toStr(map.site_city) || "Самара",
            zone_text: toStr(map.zone_text) || "Есть вопросы по поводу зоны доставки? Позвоните 202-10-20",
          }}
        />
      )}
    </div>
  );
}
