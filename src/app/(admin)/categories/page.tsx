import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { CategoriesTable } from "./CategoriesTable";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  await requireAdmin();
  const db = createServiceClient();

  const { data, error } = await db
    .from("categories")
    .select("id, name, slug, sort_order, is_visible")
    .order("sort_order", { ascending: true });

  // Сколько товаров в каждой категории — для предупреждения при удалении
  const { data: prods } = await db.from("products").select("category_id");
  const counts: Record<string, number> = {};
  for (const p of (prods ?? []) as any[]) {
    if (p.category_id !== null && p.category_id !== undefined) {
      const key = String(p.category_id);
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-slate-800">Категории</h1>
      {error ? (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          Не удалось загрузить категории: {error.message}
        </div>
      ) : (
        <CategoriesTable initial={(data ?? []) as any[]} productCounts={counts} />
      )}
    </div>
  );
}
