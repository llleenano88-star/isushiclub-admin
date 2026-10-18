import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { DeliveryForm } from "./DeliveryForm";

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

export default async function DeliveryPage() {
  await requireAdmin();
  const { data, error } = await createServiceClient()
    .from("site_settings")
    .select("key, value")
    .in("key", ["delivery_price", "free_delivery_from", "min_order"]);

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
          }}
        />
      )}
    </div>
  );
}
