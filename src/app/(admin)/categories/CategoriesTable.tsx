"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useToast } from "@/components/Toast";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
} from "@/actions/categories";

export type Category = {
  id: string | number;
  name: string;
  slug: string;
  sort_order: number;
  is_visible: boolean;
};

type SortKey = "sort_order" | "name" | "slug" | "is_visible";

type FormState = {
  name: string;
  slug: string;
  sort_order: string;
  is_visible: boolean;
};

const RU_MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh",
  щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .split("")
    .map((ch) => (ch in RU_MAP ? RU_MAP[ch] : ch))
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const emptyForm: FormState = { name: "", slug: "", sort_order: "", is_visible: true };

export function CategoriesTable({
  initial,
  productCounts,
}: {
  initial: Category[];
  productCounts: Record<string, number>;
}) {
  // Допущение: useToast() возвращает функцию toast(msg, "error"?)
  const toast = useToast();
  const [items, setItems] = useState<Category[]>(initial);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("sort_order");
  const [sortAsc, setSortAsc] = useState(true);

  const [modal, setModal] = useState<{ mode: "create" | "edit"; item?: Category } | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [slugTouched, setSlugTouched] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const [pending, startTransition] = useTransition();

  // После revalidatePath сервер присылает свежие данные
  useEffect(() => {
    setItems(initial);
  }, [initial]);

  const canDrag = sortKey === "sort_order" && sortAsc && query.trim() === "";

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? items.filter((c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q))
      : items;
    return [...filtered].sort((a, b) => {
      let r = 0;
      if (sortKey === "name") r = a.name.localeCompare(b.name, "ru");
      else if (sortKey === "slug") r = a.slug.localeCompare(b.slug);
      else if (sortKey === "is_visible") r = Number(a.is_visible) - Number(b.is_visible);
      else r = a.sort_order - b.sort_order;
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
    setSlugTouched(false);
    setFormError(null);
    setModal({ mode: "create" });
  }

  function openEdit(item: Category) {
    setForm({
      name: item.name,
      slug: item.slug,
      sort_order: String(item.sort_order),
      is_visible: item.is_visible,
    });
    setSlugTouched(true);
    setFormError(null);
    setModal({ mode: "edit", item });
  }

  function onNameChange(value: string) {
    setForm((f) => ({ ...f, name: value, slug: slugTouched ? f.slug : slugify(value) }));
  }

  function submitForm() {
    if (!modal) return;
    const orderRaw = form.sort_order.trim();
    const payload = {
      name: form.name,
      slug: form.slug,
      sort_order: orderRaw === "" ? undefined : Number(orderRaw),
      is_visible: form.is_visible,
    };

    startTransition(async () => {
      const res =
        modal.mode === "create"
          ? await createCategory(payload)
          : await updateCategory(modal.item!.id, payload);

      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      setModal(null);
      toast(modal.mode === "create" ? "Категория добавлена" : "Изменения сохранены");
    });
  }

  // ---------- видимость одним кликом ----------

  function toggleVisible(item: Category) {
    const next = !item.is_visible;
    setItems((prev) => prev.map((c) => (c.id === item.id ? { ...c, is_visible: next } : c)));
    startTransition(async () => {
      const res = await updateCategory(item.id, {
        name: item.name,
        slug: item.slug,
        is_visible: next,
      });
      if (!res.ok) {
        setItems((prev) =>
          prev.map((c) => (c.id === item.id ? { ...c, is_visible: item.is_visible } : c))
        );
        toast(res.error, "error");
      } else {
        toast(next ? "Категория показана на сайте" : "Категория скрыта с сайта");
      }
    });
  }

  // ---------- удаление ----------

  function onDelete(item: Category) {
    const count = productCounts[String(item.id)] ?? 0;
    const warning =
      count > 0
        ? `\n\nВ этой категории товаров: ${count}. После удаления они останутся без категории.`
        : "";
    if (!confirm(`Удалить категорию «${item.name}»?${warning}`)) return;

    startTransition(async () => {
      const res = await deleteCategory(item.id);
      if (!res.ok) {
        toast(res.error, "error");
        return;
      }
      setItems((prev) => prev.filter((c) => c.id !== item.id));
      toast("Категория удалена");
    });
  }

  // ---------- drag & drop ----------

  function onDrop(targetId: string) {
    if (!canDrag || dragId === null || dragId === targetId) {
      setDragId(null);
      setOverId(null);
      return;
    }
    const previous = items;
    const ordered = [...items].sort((a, b) => a.sort_order - b.sort_order);
    const from = ordered.findIndex((c) => String(c.id) === dragId);
    const to = ordered.findIndex((c) => String(c.id) === targetId);
    if (from < 0 || to < 0) return;

    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    const renumbered = ordered.map((c, i) => ({ ...c, sort_order: i + 1 }));

    setItems(renumbered);
    setDragId(null);
    setOverId(null);

    startTransition(async () => {
      const res = await reorderCategories(renumbered.map((c) => c.id));
      if (!res.ok) {
        setItems(previous);
        toast(res.error, "error");
      } else {
        toast("Порядок сохранён");
      }
    });
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск: название или slug"
            className="input w-80"
          />
          <span className="text-sm text-slate-500">Найдено: {rows.length}</span>
        </div>
        <button type="button" onClick={openCreate} className="btn btn-primary">
          + Добавить категорию
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="th w-10" />
              <th className="th cursor-pointer select-none" onClick={() => toggleSort("name")}>
                Название{mark("name")}
              </th>
              <th className="th cursor-pointer select-none" onClick={() => toggleSort("slug")}>
                Slug{mark("slug")}
              </th>
              <th className="th cursor-pointer select-none" onClick={() => toggleSort("sort_order")}>
                Порядок{mark("sort_order")}
              </th>
              <th className="th cursor-pointer select-none" onClick={() => toggleSort("is_visible")}>
                Видимость{mark("is_visible")}
              </th>
              <th className="th text-right">Действия</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="td py-8 text-center text-slate-500">
                  {items.length === 0 ? "Категорий пока нет" : "Ничего не найдено"}
                </td>
              </tr>
            )}
            {rows.map((c) => {
              const key = String(c.id);
              return (
                <tr
                  key={key}
                  draggable={canDrag}
                  onDragStart={() => setDragId(key)}
                  onDragOver={(e) => {
                    if (canDrag) {
                      e.preventDefault();
                      setOverId(key);
                    }
                  }}
                  onDrop={() => onDrop(key)}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverId(null);
                  }}
                  className={[
                    "hover:bg-slate-50",
                    dragId === key ? "opacity-40" : "",
                    overId === key && dragId !== key ? "bg-slate-100" : "",
                  ].join(" ")}
                >
                  <td
                    className={`td text-center text-slate-400 ${
                      canDrag ? "cursor-grab" : "cursor-not-allowed opacity-40"
                    }`}
                    title={
                      canDrag
                        ? "Перетащите, чтобы изменить порядок"
                        : "Перетаскивание доступно при сортировке по порядку и без поиска"
                    }
                  >
                    ⠿
                  </td>
                  <td className="td font-medium text-slate-900">{c.name}</td>
                  <td className="td text-slate-600">{c.slug}</td>
                  <td className="td text-slate-600">{c.sort_order}</td>
                  <td className="td">
                    <button
                      type="button"
                      onClick={() => toggleVisible(c)}
                      disabled={pending}
                      title="Нажмите, чтобы изменить видимость"
                      className={`badge ${
                        c.is_visible
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {c.is_visible ? "показана" : "скрыта"}
                    </button>
                  </td>
                  <td className="td text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      title="Редактировать"
                      aria-label="Редактировать"
                      className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(c)}
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
            className="w-full max-w-md rounded-lg bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-800">
                {modal.mode === "create" ? "Новая категория" : "Редактирование категории"}
              </h2>
            </div>
            <div className="space-y-4 px-5 py-4">
              {formError && (
                <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </div>
              )}
              <label className="block text-sm">
                <span className="label">Название</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => onNameChange(e.target.value)}
                  autoFocus
                  className="input w-full"
                />
              </label>
              <label className="block text-sm">
                <span className="label">Slug</span>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setForm((f) => ({ ...f, slug: e.target.value }));
                  }}
                  className="input w-full"
                />
                <span className="mt-1 block text-xs text-slate-500">
                  Создаётся из названия автоматически, можно изменить вручную.
                </span>
              </label>
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
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.is_visible}
                  onChange={(e) => setForm((f) => ({ ...f, is_visible: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Показывать на сайте
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
