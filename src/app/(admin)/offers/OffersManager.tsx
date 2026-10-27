"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { savePromotion, togglePromotion, deletePromotion } from "@/actions/offers";

type Cat = { id: string; name: string };
type Prod = { id: string; name: string; category_id: string | null; variants: string[] };
type Gift = { productId: string; label: string; name: string };
type Filter = { categoryIds: string[]; productIds: string[]; labelContains: string };
type Promo = {
  id: string; title: string; description: string | null; image_url: string | null; kind: Kind; config: any; time_from: string | null; time_to: string | null;
  weekdays: number[] | null; starts_at: string | null; ends_at: string | null; receive_type: string; is_active: boolean; sort_order: number;
};
type Kind = "gift_from_amount" | "cheapest_free" | "combo_gift" | "percent" | "fixed";

const KINDS: { v: Kind; label: string; help: string }[] = [
  { v: "gift_from_amount", label: "Подарок от суммы заказа", help: "Например: при заказе от 1500 ₽ клиент выбирает подарок из списка." },
  { v: "cheapest_free", label: "N штук + самый дешёвый в подарок", help: "Например: берёшь 2 ролла, третий (самый дешёвый по цене) в подарок: покупают 2, дарят 1." },
  { v: "combo_gift", label: "Купил товары — подарок из списка", help: "Например: 2 пиццы 40 см — пицца 30 см в подарок из списка. Условие: категория «Пицца», размер содержит «40», штук: 2. Подарки: нужные пиццы 30 см." },
  { v: "percent", label: "Скидка в процентах", help: "Скидка на заказ или на выбранные товары, например -10% на роллы." },
  { v: "fixed", label: "Скидка в рублях", help: "Фиксированная скидка, например -200 ₽ от суммы 1500 ₽." },
];
const DAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

type Form = {
  title: string; description: string; kind: Kind; time_from: string; time_to: string; weekdays: number[]; starts_at: string; ends_at: string; receive_type: string; is_active: boolean; sort_order: number;
  minSubtotal: string; buy: string; free: string; qty: string; repeat: boolean; value: string; filter: Filter; gifts: Gift[];
};
const emptyFilter: Filter = { categoryIds: [], productIds: [], labelContains: "" };
const emptyForm: Form = { title: "", description: "", kind: "gift_from_amount", time_from: "", time_to: "", weekdays: [], starts_at: "", ends_at: "", receive_type: "any", is_active: true, sort_order: 0, minSubtotal: "", buy: "2", free: "1", qty: "2", repeat: false, value: "", filter: emptyFilter, gifts: [] };

function fromPromo(p: Promo): Form {
  const c = p.config ?? {};
  return { ...emptyForm, title: p.title, description: p.description ?? "", kind: p.kind, time_from: p.time_from ?? "", time_to: p.time_to ?? "", weekdays: p.weekdays ?? [], starts_at: p.starts_at ?? "", ends_at: p.ends_at ?? "",
    receive_type: p.receive_type, is_active: p.is_active, sort_order: p.sort_order ?? 0, minSubtotal: c.minSubtotal != null ? String(c.minSubtotal) : "", buy: String(c.buy ?? 2), free: String(c.free ?? 1), qty: String(c.qty ?? 2),
    repeat: !!c.repeat, value: c.value != null ? String(c.value) : "", filter: { categoryIds: c.filter?.categoryIds ?? [], productIds: c.filter?.productIds ?? [], labelContains: c.filter?.labelContains ?? "" }, gifts: Array.isArray(c.gifts) ? c.gifts : [] };
}
function toConfig(f: Form) {
  const n = (s: string) => Number(s) || 0;
  switch (f.kind) {
    case "gift_from_amount": return { minSubtotal: n(f.minSubtotal), filter: f.filter, gifts: f.gifts };
    case "cheapest_free": return { buy: n(f.buy), free: n(f.free), filter: f.filter };
    case "combo_gift": return { qty: n(f.qty), repeat: f.repeat, filter: f.filter, gifts: f.gifts };
    default: return { value: n(f.value), minSubtotal: n(f.minSubtotal), filter: f.filter };
  }
}

function FilterEditor({ value, onChange, cats, prods }: { value: Filter; onChange: (f: Filter) => void; cats: Cat[]; prods: Prod[] }) {
  const [q, setQ] = useState("");
  const toggle = (k: "categoryIds" | "productIds", id: string) => onChange({ ...value, [k]: value[k].includes(id) ? value[k].filter((x) => x !== id) : [...value[k], id] });
  const found = q.trim() ? prods.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()) && !value.productIds.includes(p.id)).slice(0, 8) : [];
  return (
    <div className="space-y-3 rounded-md border border-slate-200 p-3">
      <p className="text-sm font-medium text-slate-700">На какие товары действует (если ничего не выбрано, на все)</p>
      <div>
        <span className="label">Категории</span>
        <div className="flex flex-wrap gap-2">{cats.map((c) => (
          <button key={c.id} type="button" onClick={() => toggle("categoryIds", c.id)} className={`rounded-full border px-3 py-1 text-sm ${value.categoryIds.includes(c.id) ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white text-slate-700"}`}>{c.name}</button>
        ))}</div>
      </div>
      <div>
        <span className="label">Отдельные товары</span>
        <input className="input" placeholder="Начните вводить название…" value={q} onChange={(e) => setQ(e.target.value)} />
        {found.length > 0 && <div className="mt-1 rounded-md border border-slate-200">{found.map((p) => <button key={p.id} type="button" className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50" onClick={() => { toggle("productIds", p.id); setQ(""); }}>{p.name}</button>)}</div>}
        <div className="mt-2 flex flex-wrap gap-2">{value.productIds.map((id) => <span key={id} className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm">{prods.find((p) => p.id === id)?.name ?? id}<button type="button" onClick={() => toggle("productIds", id)} aria-label="Убрать">×</button></span>)}</div>
      </div>
      <label className="block text-sm"><span className="label">Размер / вариант содержит (необязательно)</span>
        <input className="input" placeholder="Например: 40 (подойдут варианты «40 см»)" value={value.labelContains} onChange={(e) => onChange({ ...value, labelContains: e.target.value })} /></label>
    </div>
  );
}

function GiftEditor({ gifts, onChange, prods }: { gifts: Gift[]; onChange: (g: Gift[]) => void; prods: Prod[] }) {
  const [q, setQ] = useState("");
  const has = (productId: string, label: string) => gifts.some((g) => g.productId === productId && g.label === label);
  const rows = q.trim() ? prods.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8).flatMap((p) => p.variants.map((v) => ({ p, v }))).filter(({ p, v }) => !has(p.id, v)) : [];
  return (
    <div className="space-y-2 rounded-md border border-slate-200 p-3">
      <p className="text-sm font-medium text-slate-700">Подарки на выбор (товар и размер / количество)</p>
      <input className="input" placeholder="Найти товар: название…" value={q} onChange={(e) => setQ(e.target.value)} />
      {rows.length > 0 && <div className="max-h-48 overflow-y-auto rounded-md border border-slate-200">{rows.map(({ p, v }) => (
        <button key={`${p.id}-${v}`} type="button" className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50" onClick={() => onChange([...gifts, { productId: p.id, label: v, name: p.name }])}>{p.name} — {v}</button>
      ))}</div>}
      <div className="flex flex-wrap gap-2">{gifts.map((g) => (
        <span key={`${g.productId}-${g.label}`} className="flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-800">🎁 {g.name || prods.find((p) => p.id === g.productId)?.name} — {g.label}
          <button type="button" aria-label="Убрать" onClick={() => onChange(gifts.filter((x) => !(x.productId === g.productId && x.label === g.label)))}>×</button></span>
      ))}{!gifts.length && <span className="text-sm text-slate-400">Подарки не выбраны</span>}</div>
    </div>
  );
}

function when(p: Promo) {
  const a: string[] = [];
  if (p.time_from || p.time_to) a.push(`${p.time_from ?? "…"}–${p.time_to ?? "…"}`);
  if (p.weekdays?.length && p.weekdays.length < 7) a.push([...p.weekdays].sort().map((d) => DAYS[d - 1]).join(", "));
  if (p.starts_at || p.ends_at) a.push(`${p.starts_at ?? "…"} – ${p.ends_at ?? "…"}`);
  if (p.receive_type === "delivery") a.push("доставка"); if (p.receive_type === "pickup") a.push("самовывоз");
  return a.join(" · ") || "всегда";
}

export function OffersManager({ initial, categories, products }: { initial: Promo[]; categories: Cat[]; products: Prod[] }) {
  const toast = useToast(); const router = useRouter(); const [pending, startTransition] = useTransition();
  const [edit, setEdit] = useState<Promo | "new" | null>(null); const [f, setF] = useState<Form>(emptyForm); const [file, setFile] = useState<File | null>(null); const [rmImg, setRmImg] = useState(false);
  const open = (p: Promo | "new") => { setF(p === "new" ? { ...emptyForm, sort_order: initial.length + 1 } : fromPromo(p)); setFile(null); setRmImg(false); setEdit(p); };
  const upd = (patch: Partial<Form>) => setF((o) => ({ ...o, ...patch }));
  const save = () => startTransition(async () => {
    const fd = new FormData();
    fd.set("data", JSON.stringify({ title: f.title, description: f.description, kind: f.kind, config: toConfig(f), time_from: f.time_from, time_to: f.time_to, weekdays: f.weekdays, starts_at: f.starts_at, ends_at: f.ends_at, receive_type: f.receive_type, is_active: f.is_active, sort_order: f.sort_order }));
    if (file) fd.set("image", file); if (rmImg) fd.set("remove_image", "1");
    const r = await savePromotion(edit === "new" || !edit ? null : edit.id, fd);
    if (!r.ok) { toast(r.error, "error"); return; }
    toast("Сохранено"); setEdit(null); router.refresh();
  });
  const toggle = (p: Promo) => startTransition(async () => { const r = await togglePromotion(p.id, !p.is_active); if (!r.ok) toast(r.error, "error"); else router.refresh(); });
  const remove = (p: Promo) => { if (!confirm(`Удалить акцию «${p.title}»?`)) return; startTransition(async () => { const r = await deletePromotion(p.id); if (!r.ok) toast(r.error, "error"); else { toast("Удалено"); router.refresh(); } }); };
  const kind = KINDS.find((k) => k.v === f.kind)!;
  const needFilter = true; const needGifts = f.kind === "gift_from_amount" || f.kind === "combo_gift";
  return (
    <div>
      <button className="btn btn-primary mb-4" onClick={() => open("new")}>+ Добавить акцию</button>
      {!initial.length ? <p className="rounded-md bg-white p-6 text-sm text-slate-500">Акций пока нет.</p> : (
        <div className="space-y-2">
          {initial.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
              {p.image_url && <span className="h-14 w-14 shrink-0 rounded-md bg-cover bg-center" style={{ backgroundImage: `url(${p.image_url})` }} />}
              <div className="min-w-0 flex-1"><div className="font-medium text-slate-800">{p.title}</div><div className="text-xs text-slate-500">{KINDS.find((k) => k.v === p.kind)?.label} · {when(p)}</div></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.is_active} onChange={() => toggle(p)} disabled={pending} /> Включена</label>
              <button className="btn-secondary" onClick={() => open(p)}>Изменить</button><button className="btn-danger" onClick={() => remove(p)} disabled={pending}>Удалить</button>
            </div>
          ))}
        </div>
      )}
      {edit && (
        <Modal title={edit === "new" ? "Новая акция" : "Изменить акцию"} onClose={() => setEdit(null)} wide>
          <div className="space-y-4">
            <label className="block text-sm"><span className="label">Название (видно клиентам)</span><input className="input" value={f.title} onChange={(e) => upd({ title: e.target.value })} placeholder="Например: 2 пиццы 40 см — пицца 30 см в подарок" /></label>
            <label className="block text-sm"><span className="label">Описание</span><textarea rows={3} className="input" value={f.description} onChange={(e) => upd({ description: e.target.value })} /></label>
            <div className="text-sm"><span className="label">Картинка для карточки акции (необязательно)</span>
              {edit !== "new" && edit.image_url && !rmImg && <div className="mb-2 flex items-center gap-3"><span className="h-14 w-14 rounded-md bg-cover bg-center" style={{ backgroundImage: `url(${edit.image_url})` }} /><button type="button" className="btn-secondary" onClick={() => setRmImg(true)}>Убрать картинку</button></div>}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
            <label className="block text-sm"><span className="label">Тип акции</span>
              <select className="input" value={f.kind} onChange={(e) => upd({ kind: e.target.value as Kind })}>{KINDS.map((k) => <option key={k.v} value={k.v}>{k.label}</option>)}</select></label>
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{kind.help}</p>
            <div className="grid grid-cols-2 gap-3">
              {(f.kind === "gift_from_amount" || f.kind === "percent" || f.kind === "fixed") && <label className="block text-sm"><span className="label">{f.kind === "gift_from_amount" ? "От суммы, ₽" : "Действует от суммы, ₽ (0 = любая)"}</span><input type="number" min={0} className="input" value={f.minSubtotal} onChange={(e) => upd({ minSubtotal: e.target.value })} /></label>}
              {f.kind === "cheapest_free" && <><label className="block text-sm"><span className="label">Покупают, шт.</span><input type="number" min={1} className="input" value={f.buy} onChange={(e) => upd({ buy: e.target.value })} /></label><label className="block text-sm"><span className="label">Самых дешёвых в подарок, шт.</span><input type="number" min={1} className="input" value={f.free} onChange={(e) => upd({ free: e.target.value })} /></label></>}
              {f.kind === "combo_gift" && <><label className="block text-sm"><span className="label">Нужно купить, шт.</span><input type="number" min={1} className="input" value={f.qty} onChange={(e) => upd({ qty: e.target.value })} /></label><label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" checked={f.repeat} onChange={(e) => upd({ repeat: e.target.checked })} /> Подарок за каждые N штук (4 пиццы = 2 подарка)</label></>}
              {f.kind === "percent" && <label className="block text-sm"><span className="label">Скидка, %</span><input type="number" min={1} max={100} className="input" value={f.value} onChange={(e) => upd({ value: e.target.value })} /></label>}
              {f.kind === "fixed" && <label className="block text-sm"><span className="label">Скидка, ₽</span><input type="number" min={1} className="input" value={f.value} onChange={(e) => upd({ value: e.target.value })} /></label>}
            </div>
            {needFilter && <FilterEditor value={f.filter} onChange={(filter) => upd({ filter })} cats={categories} prods={products} />}
            {needGifts && <GiftEditor gifts={f.gifts} onChange={(gifts) => upd({ gifts })} prods={products} />}

            <div className="rounded-md border border-slate-200 p-3">
              <p className="mb-2 text-sm font-medium text-slate-700">Когда действует</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm"><span className="label">С (время)</span><input type="time" className="input" value={f.time_from} onChange={(e) => upd({ time_from: e.target.value })} /></label>
                <label className="block text-sm"><span className="label">До (время)</span><input type="time" className="input" value={f.time_to} onChange={(e) => upd({ time_to: e.target.value })} /></label>
                <label className="block text-sm"><span className="label">С даты</span><input type="date" className="input" value={f.starts_at} onChange={(e) => upd({ starts_at: e.target.value })} /></label>
                <label className="block text-sm"><span className="label">По дату включительно</span><input type="date" className="input" value={f.ends_at} onChange={(e) => upd({ ends_at: e.target.value })} /></label>
              </div>
              <p className="mt-1 text-xs text-slate-500">Время пустое = весь день. Время считается по часовому поясу из раздела «Доставка».</p>
              <div className="mt-3 flex flex-wrap gap-2">{DAYS.map((d, i) => (
                <button key={d} type="button" onClick={() => upd({ weekdays: f.weekdays.includes(i + 1) ? f.weekdays.filter((x) => x !== i + 1) : [...f.weekdays, i + 1] })} className={`rounded-full border px-3 py-1 text-sm ${f.weekdays.includes(i + 1) ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white text-slate-700"}`}>{d}</button>
              ))}<span className="self-center text-xs text-slate-500">Ничего не выбрано = каждый день</span></div>
              <label className="mt-3 block text-sm"><span className="label">Для чего</span>
                <select className="input" value={f.receive_type} onChange={(e) => upd({ receive_type: e.target.value })}><option value="any">И доставка, и самовывоз</option><option value="delivery">Только доставка</option><option value="pickup">Только самовывоз</option></select></label>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={f.is_active} onChange={(e) => upd({ is_active: e.target.checked })} /> Включена</label>
              <label className="flex items-center gap-2">Порядок <input type="number" className="input w-20" value={f.sort_order} onChange={(e) => upd({ sort_order: Number(e.target.value) })} /></label>
            </div>
            <div className="flex justify-end gap-2"><button className="btn-secondary" onClick={() => setEdit(null)}>Отмена</button><button className="btn btn-primary" onClick={save} disabled={pending}>{pending ? "Сохранение…" : "Сохранить"}</button></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
