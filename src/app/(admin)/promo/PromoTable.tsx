"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useToast } from "@/components/Toast";
import { createPromo, updatePromo, deletePromo, togglePromo } from "@/actions/promo";

type Promo = {
  id: string | number;
  code: string;
  discount_type: string;
  discount_value: number | null;
  min_order: number | null;
  expires_at: string | null;
  max_uses: number | null;
  uses_count: number | null;
  active: boolean;
};

type SortKey =
  | "code"
  | "discount_type"
  | "discount_value"
  | "min_order"
  | "expires_at"
  | "max_uses"
  | "uses_count"
  | "active";

type FormState = {
  code: string;
  discount_type: string;
  discount_value: string;
  min_order: string;
  expires_at: string;
  max_uses: string;
  active: boolean;
};

// Допущение: значения совпадают с PROMO_TYPE_VALUES в actions/promo.ts
const PROMO_TYPES: { value: string; label: string }[] = [
  { value: "percent", label: "Процент" },
  { value: "fixed", label: "Фиксированная сумма" },
  { value: "free_delivery", label: "Бесплатная доставка" },
];

const emptyForm: FormState = {
  code: "",
  discount_type: "percent",
  discount_value: "",
  min_order: "0",
  expires_at: "",
  max_uses: "",
  active: true,
};

function typeLabel(t: string) {
  return PROMO_TYPES.find((x) => x.value === t)?.label ?? t;
}

function rub(n: number | null | undefined) {
  return `${(n ?? 0).toLocaleString("ru-RU")} ₽`;
}

function valueLabel(p: Promo) {
  if (p.discount_type === "percent") return `${p.discount_value ?? 0}%`;
  if (p.discount_type === "fixed") return rub(p.discount_value);
  if (p.discount_type === "free_delivery") return "—";
  return String(p.discount_value ?? "—");
}

// Дата окончания в московском времени -> "YYYY-MM-DD"
function mskDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("sv-SE", { timeZone: "Europe/Moscow" });
}

function formatDate(iso: string | null): string {
  const d = mskDate(iso);
  if (!d) return "бессрочно";
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
}

function isExpired(iso: string | null) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && t < Date.now();
}

export function PromoTable({ initial }: { initial: Promo[] }) {
  // Допущение: useToast() возвращает функцию toast(msg, "error"?)
  const toast = useToast();
  const [items, setItems] = useState<Promo[]>(initial);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("code");
  const [sortAsc, setSortAsc] = useState(true);

  const [modal, setModal] = useState<{ mode: "create" | "edit"; item?: Promo } | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setItems(initial);
  }, [initial]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? items.filter((p) => p.code.toLowerCase().includes(q)) : items;
    return [...filtered].sort((a, b) => {
      let r = 0;
      switch (sortKey) {
        case "code":
          r = a.code.localeCompare(b.code);
          break;
        case "discount_type":
          r = typeLabel(a.discount_type).localeCompare(typeLabel(b.discount_type), "ru");
          break;
        case "expires_at": {
          // без срока — в конец при сортировке по возрастанию
          const ta = a.expires_at ? new Date(a.expires_at).getTime() : Infinity;
          const tb = b.expires_at ? new Date(b.expires_at).getTime() : Infinity;
          r = ta === tb ? 0 : ta < tb ? -1 : 1;
          break;
        }
        case "max_uses": {
          const ma = a.max_uses ?? Infinity;
          const mb = b.max_uses ?? Infinity;
          r = ma === mb ? 0 : ma < mb ? -1 : 1;
          break;
        }
        case "active":
          r = Number(a.active) - Number(b.active);
          break;
        default:
          r = (Number(a[sortKey]) || 0) - (Number(b[sortKey]) || 0);
      }
      return sortAsc ? r : -r;
    });
  }, [items, query, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  function mark(key: SortKey) {
    if (sortKey !== key) return "";
    return sortAsc ? " ▲" : " ▼";
  }

  // ---------- добавление / редактирование ----------

  function openCreate() {
    setForm(emptyForm);
    setFormError(null);
    setModal({ mode: "create" });
  }

  function openEdit(p: Promo) {
    setForm({
      code: p.code,
      discount_type: p.discount_type,
      discount_value: p.discount_value === null ? "" : String(p.discount_value),
      min_order: String(p.min_order ?? 0),
      expires_at: mskDate(p.expires_at),
      max_uses: p.max_uses === null ? "" : String(p.max_uses),
      active: p.active,
    });
    setFormError(null);
    setModal({ mode: "edit", item: p });
  }

  function submitForm() {
    if (!modal) return;
    const isFree = form.discount_type === "free_delivery";
    const payload = {
      code: form.code,
      discount_type: form.discount_type,
      discount_value: isFree ? 0 : Number(form.discount_value),
      min_order: form.min_order.trim() === "" ? 0 : Number(form.min_order),
      expires_at: form.expires_at === "" ? null : form.expires_at,
      max_uses: form.max_uses.trim() === "" ? null : Number(form.max_uses),
      active: form.active,
    };

    startTransition(async () => {
      const res =
        modal.mode === "create"
          ? await createPromo(payload)
          : await updatePromo(modal.item!.id, payload);

      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      setModal(null);
      toast(modal.mode === "create" ? "Промокод добавлен" : "Промокод обновлён");
    });
  }

  // ---------- включить / выключить ----------

  function onToggle(p: Promo) {
    const next = !p.active;
    setItems((prev) => prev.map((x) => (x.id === p.id ? { ...x, active: next } : x)));
    startTransition(async () => {
      const res = await togglePromo(p.id, next);
      if (!res.ok) {
        setItems((prev) => prev.map((x) => (x.id === p.id ? { ...x, active: p.active } : x)));
        toast(res.error, "error");
      } else {
        toast(next ? "Промокод включён" : "Промокод выключен");
      }
    });
  }

  // ---------- удаление ----------

  function onDelete(p: Promo) {
    const used = p.uses_count ?? 0;
    const note = used > 0 ? `\n\nПромокод уже использован раз: ${used}.` : "";
    if (!confirm(`Удалить промокод ${p.code}?${note}`)) return;

    startTransition(async () => {
      const res = await deletePromo(p.id);
      if (!res.ok) {
        toast(res.error, "error");
        return;
      }
      setItems((prev) => prev.filter((x) => x.id !== p.id));
      toast("Промокод удалён");
    });
  }

  const isFree = form.discount_type === "free_delivery";

  const head = (key: SortKey, label: string) => (
    <th className="th cursor-pointer select-none" onClick={() => toggleSort(key)}>
      {label}
      {mark(key)}
    </th>
  );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск: код промокода"
            className="input w-80"
          />
          <span className="text-sm text-slate-500">Найдено: {rows.length}</span>
        </div>
        <button type="button" onClick={openCreate} className="btn btn-primary">
          + Добавить промокод
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {head("code", "Код")}
              {head("discount_type", "Тип скидки")}
              {head("discount_value", "Значение")}
              {head("min_order", "Мин. сумма")}
              {head("expires_at", "Срок")}
              {head("max_uses", "Лимит")}
              {head("uses_count", "Использований")}
              {head("active", "Активен")}
              <th className="th text-right">Действия</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="td py-8 text-center text-slate-500">
                  {items.length === 0 ? "Промокодов пока нет" : "Ничего не найдено"}
                </td>
              </tr>
            )}
            {rows.map((p) => {
              const expired = isExpired(p.expires_at);
              const exhausted = p.max_uses !== null && (p.uses_count ?? 0) >= p.max_uses;
              return (
                <tr key={String(p.id)} className="hover:bg-slate-50">
                  <td className="td font-mono font-semibold text-slate-900">{p.code}</td>
                  <td className="td text-slate-600">{typeLabel(p.discount_type)}</td>
                  <td className="td text-slate-900">{valueLabel(p)}</td>
                  <td className="td text-slate-600">
                    {(p.min_order ?? 0) > 0 ? rub(p.min_order) : "—"}
                  </td>
                  <td className="td text-slate-600">
                    {formatDate(p.expires_at)}
                    {expired && (
                      <span className="badge ml-2 bg-red-100 text-red-700">истёк</span>
                    )}
                  </td>
                  <td className="td text-slate-600">
                    {p.max_uses === null ? "без лимита" : p.max_uses}
                    {exhausted && (
                      <span className="badge ml-2 bg-amber-100 text-amber-700">исчерпан</span>
                    )}
                  </td>
                  <td className="td text-slate-600">{p.uses_count ?? 0}</td>
                  <td className="td">
                    <button
                      type="button"
                      onClick={() => onToggle(p)}
                      disabled={pending}
                      title="Нажмите, чтобы включить или выключить"
                      className={`badge ${
                        p.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {p.active ? "включён" : "выключен"}
                    </button>
                  </td>
                  <td className="td text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      title="Редактировать"
                      aria-label="Редактировать"
                      className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggle(p)}
                      disabled={pending}
                      title={p.active ? "Выключить" : "Включить"}
                      aria-label={p.active ? "Выключить" : "Включить"}
                      className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    >
                      {p.active ? "⏸️" : "▶️"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(p)}
                      disabled={pending}
                      title="Удалить"
                      aria-label="Удалить"
                      className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Если в проекте есть <Modal> из components/Modal.tsx — можно заменить обёртку на него */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setModal(null)}
        >
          <div
            className="w-full max-w-lg rounded-lg bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-800">
                {modal.mode === "create" ? "Новый промокод" : "Редактирование промокода"}
              </h2>
            </div>
            <div className="space-y-4 px-5 py-4">
              {formError && (
                <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </div>
              )}
              <label className="block text-sm">
                <span className="label">Код</span>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  autoFocus
                  placeholder="Например, TEST10"
                  className="input w-full font-mono"
                />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block text-sm">
                  <span className="label">Тип скидки</span>
                  <select
                    value={form.discount_type}
                    onChange={(e) => setForm((f) => ({ ...f, discount_type: e.target.value }))}
                    className="input w-full"
                  >
                    {PROMO_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="label">
                    {form.discount_type === "percent" ? "Значение, %" : "Значение, ₽"}
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={isFree ? "" : form.discount_value}
                    onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))}
                    disabled={isFree}
                    placeholder={isFree ? "не требуется" : ""}
                    className="input w-full disabled:bg-slate-50"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <label className="block text-sm">
                  <span className="label">Мин. сумма заказа, ₽</span>
                  <input
                    type="number"
                    min={0}
                    value={form.min_order}
                    onChange={(e) => setForm((f) => ({ ...f, min_order: e.target.value }))}
                    className="input w-full"
                  />
                </label>
                <label className="block text-sm">
                  <span className="label">Макс. использований</span>
                  <input
                    type="number"
                    min={1}
                    value={form.max_uses}
                    onChange={(e) => setForm((f) => ({ ...f, max_uses: e.target.value }))}
                    placeholder="Пусто — без лимита"
                    className="input w-full"
                  />
                </label>
              </div>
              <label className="block text-sm">
                <span className="label">Действует до (включительно)</span>
                <input
                  type="date"
                  value={form.expires_at}
                  onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
                  className="input w-full"
                />
                <span className="mt-1 block text-xs text-slate-500">
                  Пусто — бессрочно. Время окончания — 23:59 по Москве.
                </span>
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Активен
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button type="button" onClick={() => setModal(null)} className="btn btn-secondary">
                Отмена
              </button>
              <button
                type="button"
                onClick={submitForm}
                disabled={pending}
                className="btn btn-primary disabled:opacity-50"
              >
                {pending ? "Сохранение…" : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
