import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { OrdersTable } from "./OrdersTable";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  await requireAdmin();
  const { data, error } = await createServiceClient()
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(2000);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-slate-800">Заказы</h1>
      {error ? (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">Не удалось загрузить заказы: {error.message}</div>
      ) : (
        <OrdersTable initial={(data ?? []) as any[]} />
      )}
    </div>
  );
}
