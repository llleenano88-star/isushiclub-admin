import { createServiceClient, createSessionClient } from "@/lib/supabase/server";

// Возвращает пользователя, если он вошёл и имеет role = 'admin'; иначе null
export async function getAdmin() {
  const supa = await createSessionClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return null;
  const { data } = await createServiceClient().from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (data?.role !== "admin") return null;
  return user;
}

// Для server actions: каждое действие проверяет роль заново
export async function requireAdmin() {
  const user = await getAdmin();
  if (!user) throw new Error("Нет доступа");
  return user;
}
