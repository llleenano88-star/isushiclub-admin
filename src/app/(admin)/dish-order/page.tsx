import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { DishOrder } from "./DishOrder";

export const dynamic = "force-dynamic";

export default async function DishOrderPage() {
  await requireAdmin();
  const db = createServiceClient();
  const [cats, prods] = await Promise.all([
    db.from("categories").select("id, name, sort_order").order("sort_order", { ascending: true }),
    db.from("products").select("id, name, category_id, sort_order, is_available").order("sort_order", { ascending: true }).order("name", { ascending: true }),
  ]);
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-slate-800">Порядок блюд</h1>
      <p className="mb-4 text-sm text-slate-500">Выберите категорию и расставьте блюда так, как они должны идти на сайте: стрелками вверх и вниз. Потом нажмите «Сохранить порядок». Новые блюда из iiko встают в конец своей категории.</p>
      {prods.error ? (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {prods.error.code === "42703" ? "Порядок блюд ещё не включён: выполните миграцию 013 в Supabase." : `Не удалось загрузить блюда: ${prods.error.message}`}
        </div>
      ) : (
        <DishOrder
          categories={((cats.data ?? []) as any[]).map((c) => ({ id: String(c.id), name: String(c.name) }))}
          products={((prods.data ?? []) as any[]).map((p) => ({ id: String(p.id), name: String(p.name), category_id: p.category_id ? String(p.category_id) : "", available: p.is_available !== false }))}
        />
      )}
    </div>
  );
}
