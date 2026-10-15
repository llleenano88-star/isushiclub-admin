import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Клиент с сессией пользователя (читает cookies)
export async function createSessionClient() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return store.getAll();
        },
        setAll(list: { name: string; value: string; options?: any }[]) {
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            // вызов из Server Component — cookies обновит middleware
          }
        },
      },
    }
  );
}

// Сервисный клиент (обходит RLS). Только на сервере, только после проверки админа!
export function createServiceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}