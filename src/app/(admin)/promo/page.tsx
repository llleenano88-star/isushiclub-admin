import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { PromoTable } from "./PromoTable";

export const dynamic = "force-dynamic";

export default async function PromoPage() {
  await requireAdmin();
  const db = createServiceClient();
  const { data, error } = await db.from("promo_codes").select("*").order("code", { ascending: true });
  const { data: prods } = await db.from("products").select("id, name, variants").order("name", { ascending: true });
  const products = ((prods ?? []) as any[]).map((p) => ({ id: String(p.id), name: String(p.name), variants: (Array.isArray(p.variants) ? p.variants : []).map((v: any) => String(v?.label ?? "")).filter(Boolean) }));

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-slate-800">Промокоды</h1>
      {error ? (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          Не удалось загрузить промокоды: {error.message}
        </div>
      ) : (
        <PromoTable initial={(data ?? []) as any[]} products={products} />
      )}
    </div>
  );
}
