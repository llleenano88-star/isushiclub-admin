import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { PromoTable } from "./PromoTable";

export const dynamic = "force-dynamic";

export default async function PromoPage() {
  await requireAdmin();
  const { data, error } = await createServiceClient()
    .from("promo_codes")
    .select("*")
    .order("code", { ascending: true });

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-slate-800">Промокоды</h1>
      {error ? (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          Не удалось загрузить промокоды: {error.message}
        </div>
      ) : (
        <PromoTable initial={(data ?? []) as any[]} />
      )}
    </div>
  );
}
