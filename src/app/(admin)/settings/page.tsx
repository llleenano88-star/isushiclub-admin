import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { asString, readSettings } from "@/lib/settings";
import { WorkForm } from "./WorkForm";
import { StopList } from "./StopList";
import { StaffTable } from "./StaffTable";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const me = await requireAdmin();
  const db = createServiceClient();

  const { map, error } = await readSettings(["work_time_from", "work_time_to", "work_days"]);

  const { data: products } = await db
    .from("products")
    .select("id, name, is_available")
    .order("name", { ascending: true });

  // Сотрудники: роли из profiles, email и дата создания — из Supabase Auth
  const { data: profiles } = await db.from("profiles").select("id, role").eq("role", "admin");
  const { data: usersData } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const usersById = new Map<string, { email: string; created_at: string }>();
  for (const u of usersData?.users ?? []) {
    usersById.set(u.id, { email: u.email ?? "", created_at: u.created_at });
  }
  const admins = ((profiles ?? []) as any[]).map((p) => ({
    id: String(p.id),
    role: String(p.role),
    email: usersById.get(String(p.id))?.email ?? "",
    created_at: usersById.get(String(p.id))?.created_at ?? "",
  }));

  // Допущение: work_days — массив чисел 1–7 (1 = понедельник). Нет значения — работаем все дни.
  const rawDays = map.work_days;
  const workDays = Array.isArray(rawDays)
    ? rawDays.map((d) => Number(d)).filter((d) => d >= 1 && d <= 7)
    : [1, 2, 3, 4, 5, 6, 7];

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-slate-800">Настройки</h1>
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
          Не удалось загрузить настройки: {error}
        </div>
      )}
      <div className="max-w-4xl space-y-5">
        <WorkForm
          initial={{
            work_time_from: asString(map.work_time_from) || "10:00",
            work_time_to: asString(map.work_time_to) || "22:00",
            work_days: workDays,
          }}
        />
        <StopList products={(products ?? []) as any[]} />
        <StaffTable admins={admins} currentUserId={me.id} />
      </div>
    </div>
  );
}
