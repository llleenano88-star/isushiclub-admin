import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { OffersManager } from "./OffersManager";

export const dynamic = "force-dynamic";

export default async function OffersPage() {
  await requireAdmin();
  const db = createServiceClient();
  const [promos, cats, prods] = await Promise.all([
    db.from("promotions").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: false }),
    db.from("categories").select("id, name").order("sort_order", { ascending: true }),
    db.from("products").select("id, name, category_id, variants").order("name", { ascending: true }),
  ]);
  const products = ((prods.data ?? []) as any[]).map((p) => ({
    id: String(p.id), name: String(p.name), category_id: p.category_id ? String(p.category_id) : null,
    variants: (Array.isArray(p.variants) ? p.variants : []).map((v: any) => String(v?.label ?? "")).filter(Boolean),
  }));
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-slate-800">Акции</h1>
      <p className="mb-4 text-sm text-slate-500">Подарок от суммы, «2 + 1 в подарок», комбо с подарком из списка, скидки. Каждую акцию можно ограничить временем (например, с 10:00 до 16:00), днями недели и датами. Акции показываются на сайте и считаются в корзине автоматически.</p>
      {promos.error ? (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {promos.error.code === "42P01" ? "Таблица акций ещё не создана: выполните миграцию 011 в Supabase." : `Не удалось загрузить акции: ${promos.error.message}`}
        </div>
      ) : (
        <OffersManager initial={(promos.data ?? []) as any[]} categories={(cats.data ?? []) as any[]} products={products} />
      )}
    </div>
  );
}
