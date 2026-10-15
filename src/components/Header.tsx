"use client";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function Header({ email }: { email: string }) {
  const router = useRouter();
  async function logout() {
    await createBrowserSupabase().auth.signOut();
    router.replace("/login");
    router.refresh();
  }
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between bg-slate-900 px-5 text-white shadow">
      <div className="flex items-center gap-2 text-base font-semibold">
        <span className="rounded bg-emerald-600 px-2 py-0.5 text-sm">iSushiClub</span>
        <span className="text-slate-300">Админ-панель</span>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <span className="text-slate-300">{email}</span>
        <button onClick={logout} className="rounded-md border border-slate-600 px-3 py-1.5 text-slate-200 hover:bg-slate-800">
          Выйти
        </button>
      </div>
    </header>
  );
}
