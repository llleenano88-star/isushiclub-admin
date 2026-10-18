"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

export async function addAdmin(email: string, password: string) {
  await requireAdmin();
  const e = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { ok: false as const, error: "Некорректный email" };
  if (password.length < 8) return { ok: false as const, error: "Пароль должен быть не короче 8 символов" };

  const db = createServiceClient();
  const { data, error } = await db.auth.admin.createUser({
    email: e,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    const msg = error?.message ?? "Не удалось создать пользователя";
    if (/already|registered|exists/i.test(msg)) {
      return { ok: false as const, error: "Пользователь с таким email уже существует" };
    }
    return { ok: false as const, error: msg };
  }

  const { error: profileError } = await db
    .from("profiles")
    .upsert({ id: data.user.id, role: "admin" }, { onConflict: "id" });
  if (profileError) {
    await db.auth.admin.deleteUser(data.user.id); // не оставляем «пустого» пользователя
    return { ok: false as const, error: profileError.message };
  }

  revalidatePath("/settings");
  return { ok: true as const };
}

// «Удаление» админа = снятие роли. Учётная запись остаётся, но в админку войти нельзя.
// Допущение: роль обычного пользователя в profiles.role — "user".
export async function removeAdmin(id: string) {
  const me = await requireAdmin();
  if (id === me.id) return { ok: false as const, error: "Нельзя удалить самого себя" };

  const db = createServiceClient();
  const { data: admins } = await db.from("profiles").select("id").eq("role", "admin");
  if ((admins ?? []).length <= 1) {
    return { ok: false as const, error: "Нельзя удалить последнего администратора" };
  }

  const { error } = await db.from("profiles").update({ role: "user" }).eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/settings");
  return { ok: true as const };
}
