"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { checkAdmin } from "@/actions/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Если middleware вернул сюда обычного пользователя — разлогиниваем и показываем «Нет доступа»
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "forbidden") {
      createBrowserSupabase().auth.signOut();
      setError("Нет доступа");
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createBrowserSupabase();
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) {
      setError("Неверный email или пароль");
      setLoading(false);
      return;
    }
    const ok = await checkAdmin();
    if (!ok) {
      await supabase.auth.signOut();
      setError("Нет доступа");
      setLoading(false);
      return;
    }
    router.replace("/orders");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6">
          <div className="mb-3 inline-block rounded bg-slate-900 px-3 py-1 text-sm font-semibold text-white">
            <span className="text-emerald-400">i</span>SushiClub
          </div>
          <h1 className="text-xl font-semibold text-slate-800">Вход в админ-панель</h1>
        </div>
        <div className="mb-4">
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" required autoFocus autoComplete="username" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="mb-5">
          <label className="label" htmlFor="password">Пароль</label>
          <input id="password" type="password" required autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Входим…" : "Войти"}
        </button>
      </form>
    </main>
  );
}
