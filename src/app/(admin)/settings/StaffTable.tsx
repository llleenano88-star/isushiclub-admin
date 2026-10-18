"use client";

import { useEffect, useState, useTransition } from "react";
import { useToast } from "@/components/Toast";
import { addAdmin, removeAdmin } from "@/actions/staff";

type Admin = { id: string; role: string; email: string; created_at: string };

function dateLabel(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" });
}

export function StaffTable({ admins, currentUserId }: { admins: Admin[]; currentUserId: string }) {
  // Допущение: useToast() возвращает функцию toast(msg, "error"?)
  const toast = useToast();
  const [items, setItems] = useState<Admin[]>(admins);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setItems(admins);
  }, [admins]);

  function openModal() {
    setEmail("");
    setPassword("");
    setFormError(null);
    setOpen(true);
  }

  function submit() {
    startTransition(async () => {
      const res = await addAdmin(email, password);
      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      setOpen(false);
      toast("Администратор добавлен");
    });
  }

  function onRemove(a: Admin) {
    if (
      !confirm(
        `Удалить администратора ${a.email || a.id}?\n\nУчётная запись сохранится, но войти в админ-панель с ней будет нельзя.`
      )
    )
      return;
    startTransition(async () => {
      const res = await removeAdmin(a.id);
      if (!res.ok) {
        toast(res.error, "error");
        return;
      }
      setItems((prev) => prev.filter((x) => x.id !== a.id));
      toast("Администратор удалён");
    });
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800">Сотрудники</h2>
        <button type="button" onClick={openModal} className="btn btn-primary">
          + Добавить админа
        </button>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="th">Email</th>
              <th className="th">Роль</th>
              <th className="th">Дата создания</th>
              <th className="th text-right">Действия</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="td py-6 text-center text-slate-500">
                  Администраторов нет
                </td>
              </tr>
            )}
            {items.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="td font-medium text-slate-900">
                  {a.email || "—"}
                  {a.id === currentUserId && (
                    <span className="badge ml-2 bg-slate-100 text-slate-600">это вы</span>
                  )}
                </td>
                <td className="td">
                  <span className="badge bg-emerald-100 text-emerald-700">администратор</span>
                </td>
                <td className="td text-slate-600">{dateLabel(a.created_at)}</td>
                <td className="td text-right">
                  {a.id !== currentUserId && (
                    <button
                      type="button"
                      onClick={() => onRemove(a)}
                      disabled={pending}
                      title="Удалить"
                      aria-label="Удалить"
                      className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700"
                    >
                      🗑️
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Если в проекте есть <Modal> из components/Modal.tsx — можно заменить обёртку на него */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-800">Новый администратор</h2>
            </div>
            <div className="space-y-4 px-5 py-4">
              {formError && (
                <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>
              )}
              <label className="block text-sm">
                <span className="label">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  className="input w-full"
                />
              </label>
              <label className="block text-sm">
                <span className="label">Пароль</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="input w-full"
                />
                <span className="mt-1 block text-xs text-slate-500">Не короче 8 символов.</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">
                Отмена
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending}
                className="btn btn-primary disabled:opacity-50"
              >
                {pending ? "Создание…" : "Добавить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
