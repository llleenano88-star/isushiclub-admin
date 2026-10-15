import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { ProductsTable } from "./ProductsTable";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  await requireAdmin();
  const db = createServiceClient();
  const [products, categories] = await Promise.all([
    db.from("products").select("*").order("name"),
    db.from("categories").select("id,name").order("sort_order"),
  ]);
  const error = products.error || categories.error;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-slate-800">Товары</h1>
      {error ? (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">Не удалось загрузить данные: {error.message}</div>
      ) : (
        <ProductsTable initial={(products.data ?? []) as any[]} categories={(categories.data ?? []) as any[]} />
      )}
    </div>
  );
}
