"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useToast } from "@/components/Toast";
import { ImagePicker } from "@/components/ImagePicker";
import { SPECS } from "@/lib/imageCrop";
import { createExtra, updateExtra, toggleExtra, deleteExtra } from "@/actions/extras";

type Extra = {
  id: string | number;
  name: string;
  price: number | null;
  image_url: string | null;
  iiko_id: string | null;
  is_default: boolean;
  is_active: boolean;
  sort_order: number | null;
};

type SortKey = "name" | "price" | "iiko_id" | "is_default" | "is_active";

type FormState = {
  name: string;
  price: string;
  iiko_id: string;
  sort_order: string;
  is_default: boolean;
  is_active: boolean;
};

const emptyForm: FormState = {
  name: "",
  price: "0",
  iiko_id: "",
  sort_order: "",
  is_default: false,
  is_active: true,
};

function rub(n: number | null | undefined) {
  return `${(n ?? 0).toLocaleString("ru-RU")} ₽`;
}

export function ExtrasTable({ initial }: { initial: Extra[] }) {
  // Допущение: useToast() возвращает функцию toast(msg, "error"?)
  const toast = useToast();
  const [items, setItems] = useState<Extra[]>(initial);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const [modal, setModal] = useState<{ mode: "create" | "edit"; item?: Extra } | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setItems(initial);
  }, [initial]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? items.filter(
          (x) => x.name.toLowerCase().includes(q) || (x.iiko_id ?? "").toLowerCase().includes(q)
        )
      : items;
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      let r = 0;
      if (sortKey === "name") r = a.name.localeCompare(b.name, "ru");
      else if (sortKey === "iiko_id") r = (a.iiko_id ?? "").localeCompare(b.iiko_id ?? "");
      else if (sortKey === "price") r = (a.price ?? 0) - (b.price ?? 0);
      else r = Number(a[sortKey]) - Number(b[sortKey]);
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
    setFile(null);
    setPreview(null);
    setRemoveImage(false);
    setFormError(null);
    setModal({ mode: "create" });
  }

  function openEdit(x: Extra) {
    setForm({
      name: x.name,
      price: String(x.price ?? 0),
      iiko_id: x.iiko_id ?? "",
      sort_order: x.sort_order === null ? "" : String(x.sort_order),
      is_default: x.is_default,
      is_active: x.is_active,
    });
    setFile(null);
    setPreview(x.image_url);
    setRemoveImage(false);
    setFormError(null);
    setModal({ mode: "edit", item: x });
  }

  function onCropped(result: { file: File; preview: string } | null) {
    if (result) {
      setFile(result.file);
      setPreview(result.preview);
      setRemoveImage(false);
    } else {
      setFile(null);
      setPreview(null);
      setRemoveImage(true);
    }
  }

  function submitForm() {
    if (!modal) return;
    const fd = new FormData();
    fd.set("name", form.name);
    fd.set("price", form.price);
    fd.set("iiko_id", form.iiko_id);
    fd.set("sort_order", form.sort_order);
    fd.set("is_default", form.is_default ? "1" : "0");
    fd.set("is_active", form.is_active ? "1" : "0");
    if (file) fd.set("image", file);
    if (removeImage) fd.set("remove_image", "1");

    startTransition(async () => {
      const res =
        modal.mode === "create" ? await createExtra(fd) : await updateExtra(modal.item!.id, fd);
      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      setModal(null);
      toast(modal.mode === "create" ? "Доп. товар добавлен" : "Изменения сохранены");
    });
  }

  // ---------- переключатели ----------

  function onToggle(x: Extra, field: "is_active" | "is_default") {
    const next = !x[field];
    setItems((prev) => prev.map((i) => (i.id === x.id ? { ...i, [field]: next } : i)));
    startTransition(async () => {
      const res = await toggleExtra(x.id, field, next);
      if (!res.ok) {
        setItems((prev) => prev.map((i) => (i.id === x.id ? { ...i, [field]: x[field] } : i)));
        toast(res.error, "error");
      }
    });
  }

  // ---------- удаление ----------

  function onDelete(x: Extra) {
    if (!confirm(`Удалить доп. товар «${x.name}»?`)) return;
    startTransition(async () => {
      const res = await deleteExtra(x.id);
      if (!res.ok) {
        toast(res.error, "error");
        return;
      }
      setItems((prev) => prev.filter((i) => i.id !== x.id));
      toast("Доп. товар удалён");
    });
  }

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
            placeholder="Поиск: название или iiko_id"
            className="input w-80"
          />
          <span className="text-sm text-slate-500">Найдено: {rows.length}</span>
        </div>
        <button type="button" onClick={openCreate} className="btn btn-primary">
          + Добавить
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="th w-20">Фото</th>
              {head("name", "Название")}
              {head("price", "Цена")}
              {head("iiko_id", "iiko_id")}
              {head("is_default", "По умолчанию")}
              {head("is_active", "Активен")}
              <th className="th text-right">Действия</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="td py-8 text-center text-slate-500">
                  {items.length === 0 ? "Доп. товаров пока нет" : "Ничего не найдено"}
                </td>
              </tr>
            )}
            {rows.map((x) => (
              <tr key={String(x.id)} className="hover:bg-slate-50">
                <td className="td">
                  <div className="h-11 w-11 overflow-hidden rounded-md bg-slate-100">
                    {x.image_url && (
                      <img src={x.image_url} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                </td>
                <td className="td font-medium text-slate-900">{x.name}</td>
                <td className="td text-slate-900">{rub(x.price)}</td>
                <td className="td text-slate-600">{x.iiko_id || "—"}</td>
                <td className="td">
                  <button
                    type="button"
                    onClick={() => onToggle(x, "is_default")}
                    disabled={pending}
                    title="Нажмите, чтобы изменить"
                    className={`badge ${
                      x.is_default ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {x.is_default ? "да" : "нет"}
                  </button>
                </td>
                <td className="td">
                  <button
                    type="button"
                    onClick={() => onToggle(x, "is_active")}
                    disabled={pending}
                    title="Нажмите, чтобы изменить"
                    className={`badge ${
                      x.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {x.is_active ? "активен" : "скрыт"}
                  </button>
                </td>
                <td className="td text-right">
                  <button
                    type="button"
                    onClick={() => openEdit(x)}
                    title="Редактировать"
                    aria-label="Редактировать"
                    className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(x)}
                    disabled={pending}
                    title="Удалить"
                    aria-label="Удалить"
                    className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
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
                {modal.mode === "create" ? "Новый доп. товар" : "Редактирование доп. товара"}
              </h2>
            </div>
            <div className="space-y-4 px-5 py-4">
              {formError && (
                <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>
              )}
              <label className="block text-sm">
                <span className="label">Название</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  autoFocus
                  placeholder="Например, Имбирь"
                  className="input w-full"
                />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block text-sm">
                  <span className="label">Цена, ₽</span>
                  <input
                    type="number"
                    min={0}
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    className="input w-full"
                  />
                </label>
                <label className="block text-sm">
                  <span className="label">iiko_id</span>
                  <input
                    type="text"
                    value={form.iiko_id}
                    onChange={(e) => setForm((f) => ({ ...f, iiko_id: e.target.value }))}
                    className="input w-full"
                  />
                </label>
              </div>
              <div className="text-sm">
                <span className="label">Фото (квадрат 1:1, итог 500×500)</span>
                <ImagePicker
                  preview={preview}
                  spec={SPECS.product}
                  onChange={onCropped}
                  onError={(m) => setFormError(m)}
                  title="Обрезка фото доп. товара"
                />
              </div>
              <label className="block text-sm">
                <span className="label">Порядок</span>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
                  placeholder="Пусто — в конец списка"
                  className="input w-full"
                />
              </label>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.is_default}
                    onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  По умолчанию
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Активен
                </label>
              </div>
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
