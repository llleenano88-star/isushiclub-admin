import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { ExtrasTable } from "./ExtrasTable";

export const dynamic = "force-dynamic";

export default async function ExtrasPage() {
  await requireAdmin();
  const { data, error } = await createServiceClient()
    .from("extras")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-slate-800">Доп. товары</h1>
      {error ? (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          Не удалось загрузить доп. товары: {error.message}
        </div>
      ) : (
        <ExtrasTable initial={(data ?? []) as any[]} />
      )}
    </div>
  );
}
