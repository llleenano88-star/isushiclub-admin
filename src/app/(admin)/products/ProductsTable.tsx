"use client";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { ImagePicker } from "@/components/ImagePicker";
import { SPECS } from "@/lib/imageCrop";
import { deleteProducts, saveProduct, setProductsAvailable } from "@/actions/products";
import { money, sortBy } from "@/lib/utils";

type Product = Record<string, any>;
type Category = { id: string | number; name: string };
type OptGroup = { title: string; choices: string };
type Variant = { label: string; price: string; iiko_id: string; sizeId?: string | null };

const minPrice = (p: Product) => {
  const prices = (Array.isArray(p.variants) ? p.variants : []).map((v: any) => Number(v.price)).filter((n: number) => n > 0);
  return prices.length ? Math.min(...prices) : 0;
};

export function ProductsTable({ initial, categories }: { initial: Product[]; categories: Category[] }) {
  const toast = useToast();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [edit, setEdit] = useState<Product | "new" | null>(null);

  const catName = (id: any) => categories.find((c) => String(c.id) === String(id))?.name ?? "—";

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = initial.filter(
      (p) =>
        (!cat || String(p.category_id) === cat) &&
        (!needle || String(p.name ?? "").toLowerCase().includes(needle) || String(p.iiko_id ?? "").toLowerCase().includes(needle))
    );
    return sortBy(
      list,
      (p) => {
        if (sort.key === "price") return minPrice(p);
        if (sort.key === "category") return catName(p.category_id);
        if (sort.key === "is_available") return p.is_available ? 1 : 0;
        return p[sort.key];
      },
      sort.dir
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, q, cat, sort, categories]);

  const toggleSort = (key: string) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  const arrow = (key: string) => (sort.key === key ? (sort.dir === "asc" ? "▲" : "▼") : "");

  const allChecked = rows.length > 0 && rows.every((p) => selected.has(String(p.id)));
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(rows.map((p) => String(p.id))));
  const toggleOne = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  async function bulkVisible(value: boolean) {
    const res = await setProductsAvailable([...selected], value);
    if (res.ok) {
      toast(value ? "Товары показаны" : "Товары скрыты");
      setSelected(new Set());
      router.refresh();
    } else toast(res.error, "error");
  }

  async function bulkDelete() {
    if (!confirm(`Удалить выбранные товары (${selected.size})? Это действие нельзя отменить.`)) return;
    const res = await deleteProducts([...selected]);
    if (res.ok) {
      toast("Товары удалены");
      setSelected(new Set());
      router.refresh();
    } else toast(res.error, "error");
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input className="input !w-72" placeholder="Поиск: название или iiko_id" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input !w-52" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Все категории</option>
          {categories.map((c) => (
            <option key={String(c.id)} value={String(c.id)}>{c.name}</option>
          ))}
        </select>
        <span className="text-sm text-slate-500">Найдено: {rows.length}</span>
        <button className="btn-primary ml-auto" onClick={() => setEdit("new")}>+ Добавить товар</button>
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm">
          <span className="font-medium">Выбрано: {selected.size}</span>
          <button className="btn-secondary !py-1" onClick={() => bulkVisible(false)}>Скрыть</button>
          <button className="btn-secondary !py-1" onClick={() => bulkVisible(true)}>Показать</button>
          <button className="btn-danger !py-1" onClick={bulkDelete}>Удалить</button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th w-10"><input type="checkbox" checked={allChecked} onChange={toggleAll} /></th>
              <th className="th w-16">Фото</th>
              <th className="th cursor-pointer hover:bg-slate-200" onClick={() => toggleSort("name")}>Название {arrow("name")}</th>
              <th className="th cursor-pointer hover:bg-slate-200" onClick={() => toggleSort("category")}>Категория {arrow("category")}</th>
              <th className="th cursor-pointer hover:bg-slate-200" onClick={() => toggleSort("price")}>Цена {arrow("price")}</th>
              <th className="th cursor-pointer hover:bg-slate-200" onClick={() => toggleSort("is_available")}>Видимость {arrow("is_available")}</th>
              <th className="th">iiko_id</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const id = String(p.id);
              const n = Array.isArray(p.variants) ? p.variants.length : 0;
              return (
                <tr key={id} className="cursor-pointer hover:bg-slate-50" onClick={() => setEdit(p)}>
                  <td className="td" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(id)} onChange={() => toggleOne(id)} />
                  </td>
                  <td className="td">
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt="" className="h-10 w-10 rounded object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded bg-slate-100" />
                    )}
                  </td>
                  <td className="td font-medium">
                    {p.name} {p.is_new && <span className="badge ml-1 bg-amber-100 text-amber-700">новинка</span>}
                  </td>
                  <td className="td">{catName(p.category_id)}</td>
                  <td className="td whitespace-nowrap">
                    {minPrice(p) ? (n > 1 ? "от " : "") + money(minPrice(p)) : "—"}
                  </td>
                  <td className="td">
                    {p.is_available ? (
                      <span className="badge bg-emerald-100 text-emerald-700">показан</span>
                    ) : (
                      <span className="badge bg-slate-200 text-slate-600">скрыт</span>
                    )}
                  </td>
                  <td className="td text-xs text-slate-500">{p.iiko_id || "—"}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td className="td py-10 text-center text-slate-400" colSpan={7}>Товаров не найдено</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {edit && (
        <ProductModal
          product={edit === "new" ? null : edit}
          categories={categories}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ProductModal({
  product,
  categories,
  onClose,
  onSaved,
}: {
  product: Product | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(product?.image_url ?? null);
  const [cropped, setCropped] = useState<File | null>(null); // обрезанное фото (WebP), если выбрано
  const [variants, setVariants] = useState<Variant[]>(() => {
    const v = Array.isArray(product?.variants) ? product!.variants : [];
    return v.length
      ? v.map((x: any) => ({ label: String(x.label ?? x.name ?? ""), price: String(x.price ?? ""), iiko_id: String(x.iiko_id ?? ""), sizeId: x.sizeId ?? null }))
      : [{ label: "", price: "", iiko_id: "" }];
  });

  // Выбор у товара: заголовок + варианты, по одному в строке. Своих iiko-кодов у вариантов выбора нет.
  const [opts, setOpts] = useState<OptGroup[]>(() =>
    (Array.isArray(product?.options) ? product!.options : []).map((g: any) => ({
      title: String(g?.title ?? ""),
      choices: (Array.isArray(g?.choices) ? g.choices : []).join("\n"),
    }))
  );
  const setOpt = (i: number, patch: Partial<OptGroup>) =>
    setOpts((l) => l.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));

  const setVar = (i: number, patch: Partial<Variant>) =>
    setVariants((l) => l.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(formRef.current!);
    // iiko_id варианта сохраняем только если он заполнен; пустой — берётся iiko_id товара
    fd.set(
      "variants",
      JSON.stringify(
        variants.map(({ iiko_id, ...v }) => (iiko_id.trim() ? { ...v, iiko_id: iiko_id.trim() } : v))
      )
    );
    fd.set(
      "options",
      JSON.stringify(opts.map((g) => ({ title: g.title.trim(), choices: g.choices.split("\n").map((c) => c.trim()).filter(Boolean) })))
    );
    // Если фото не выбрано — отправляем пустой файл, как раньше отправлял пустой input
    fd.set("image", cropped ?? new File([], ""));
    const res = await saveProduct(fd);
    setSaving(false);
    if (res.ok) {
      toast("Товар сохранён");
      onSaved();
    } else toast(res.error, "error");
  }

  return (
    <Modal title={product ? "Редактирование товара" : "Новый товар"} onClose={onClose} wide>
      <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
        <input type="hidden" name="id" value={product?.id ?? ""} />
        <div>
          <label className="label">Название</label>
          <input name="name" required defaultValue={product?.name ?? ""} className="input" />
        </div>
        <div>
          <label className="label">Описание</label>
          <textarea name="description" rows={3} defaultValue={product?.description ?? ""} className="input" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Категория</label>
            <select name="category_id" defaultValue={product?.category_id ?? ""} className="input">
              <option value="">— без категории —</option>
              {categories.map((c) => (
                <option key={String(c.id)} value={String(c.id)}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">iiko_id</label>
            <input name="iiko_id" defaultValue={product?.iiko_id ?? ""} className="input" />
          </div>
        </div>

        <div>
          <label className="label">Варианты (размер, цена и iiko_id)</label>
          <div className="space-y-2">
            {variants.map((v, i) => (
              <div key={i} className="flex gap-2">
                <input className="input" placeholder="Например: 8 шт." value={v.label} onChange={(e) => setVar(i, { label: e.target.value })} />
                <input className="input !w-32" type="number" min="0" step="1" placeholder="Цена, ₽" value={v.price} onChange={(e) => setVar(i, { price: e.target.value })} />
                <input className="input !w-64" placeholder="iiko_id варианта (необязательно)" value={v.iiko_id} onChange={(e) => setVar(i, { iiko_id: e.target.value })} />
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={variants.length === 1}
                  onClick={() => setVariants((l) => l.filter((_, idx) => idx !== i))}
                  aria-label="Удалить вариант"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn-secondary mt-2" onClick={() => setVariants((l) => [...l, { label: "", price: "", iiko_id: "" }])}>
            + Добавить вариант
          </button>
        </div>

        <div>
          <label className="label">Выбор у товара (необязательно)</label>
          <p className="mb-2 text-xs text-slate-500">
            Клиент обязательно выберет один вариант из каждой группы, выбор уйдёт в комментарий к заказу в iiko. Отдельных iiko-кодов у выбора нет.
          </p>
          <div className="space-y-3">
            {opts.map((g, i) => (
              <div key={i} className="rounded-md border border-slate-200 p-3">
                <div className="mb-2 flex gap-2">
                  <input className="input" placeholder="Заголовок, например: Соус" value={g.title} onChange={(e) => setOpt(i, { title: e.target.value })} />
                  <button type="button" className="btn-secondary" aria-label="Удалить выбор" onClick={() => setOpts((l) => l.filter((_, idx) => idx !== i))}>×</button>
                </div>
                <textarea className="input" rows={3} placeholder={"Варианты, каждый с новой строки:\nОстрый\nНе острый"} value={g.choices} onChange={(e) => setOpt(i, { choices: e.target.value })} />
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={() => setOpts((l) => [...l, { title: "Соус", choices: "Острый\nНе острый" }])}>
              + Соус: острый / не острый
            </button>
            <button type="button" className="btn-secondary" onClick={() => setOpts((l) => [...l, { title: "Ролл", choices: "" }])}>
              + Выбор ролла
            </button>
          </div>
        </div>

        <div>
          <label className="label">Фото (квадрат 1:1, итог 500×500)</label>
          <ImagePicker
            preview={preview}
            spec={SPECS.product}
            allowRemove={false}
            title="Обрезка фото товара"
            onError={(m) => toast(m, "error")}
            onChange={(result) => {
              if (result) {
                setCropped(result.file);
                setPreview(result.preview);
              }
            }}
          />
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_available" defaultChecked={product ? !!product.is_available : true} /> Показывать на сайте
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_new" defaultChecked={!!product?.is_new} /> Новинка
          </label>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button type="button" className="btn-secondary" onClick={onClose}>Отмена</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Сохраняем…" : "Сохранить"}</button>
        </div>
      </form>
    </Modal>
  );
}
