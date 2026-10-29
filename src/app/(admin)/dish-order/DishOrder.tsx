"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { saveProductOrder } from "@/actions/dishorder";

type Cat = { id: string; name: string };
type Prod = { id: string; name: string; category_id: string; available: boolean };

export function DishOrder({ categories, products }: { categories: Cat[]; products: Prod[] }) {
  const toast = useToast(); const router = useRouter(); const [pending, startTransition] = useTransition();
  const cats = useMemo(() => [...categories, ...(products.some((p) => !p.category_id) ? [{ id: "", name: "Без категории" }] : [])], [categories, products]);
  const [cat, setCat] = useState(cats[0]?.id ?? "");
  // порядок id внутри каждой категории (изначально как в базе)
  const [orders, setOrders] = useState<Record<string, string[]>>(() => {
    const o: Record<string, string[]> = {};
    for (const c of cats) o[c.id] = products.filter((p) => p.category_id === c.id).map((p) => p.id);
    return o;
  });
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const list = orders[cat] ?? [];
  const move = (from: number, to: number) => {
    if (to < 0 || to >= list.length || from === to) return;
    const next = [...list]; const [x] = next.splice(from, 1); next.splice(to, 0, x);
    setOrders((o) => ({ ...o, [cat]: next })); setDirty((d) => ({ ...d, [cat]: true }));
  };
  const save = () => startTransition(async () => {
    const r = await saveProductOrder(list);
    if (!r.ok) { toast(r.error, "error"); return; }
    toast("Порядок сохранён"); setDirty((d) => ({ ...d, [cat]: false })); router.refresh();
  });
  const btn = "grid h-9 w-9 place-items-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-30";
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select className="input max-w-xs" value={cat} onChange={(e) => setCat(e.target.value)}>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name} ({(orders[c.id] ?? []).length})</option>)}
        </select>
        <button className="btn btn-primary disabled:opacity-50" onClick={save} disabled={pending || !dirty[cat]}>{pending ? "Сохранение…" : "Сохранить порядок"}</button>
        {dirty[cat] && <span className="text-sm text-amber-600">Есть несохранённые изменения</span>}
      </div>
      {!list.length ? <p className="rounded-md bg-white p-6 text-sm text-slate-500">В этой категории пока нет блюд.</p> : (
        <ol className="space-y-1.5">
          {list.map((id, i) => {
            const p = byId.get(id); if (!p) return null;
            return (
              <li key={id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <span className="w-7 text-right text-sm text-slate-400">{i + 1}</span>
                <span className={`flex-1 text-sm ${p.available ? "text-slate-800" : "text-slate-400 line-through"}`}>{p.name}{!p.available && " (скрыто)"}</span>
                <button type="button" className={btn} title="В начало" onClick={() => move(i, 0)} disabled={i === 0}>⤒</button>
                <button type="button" className={btn} title="Выше" onClick={() => move(i, i - 1)} disabled={i === 0}>↑</button>
                <button type="button" className={btn} title="Ниже" onClick={() => move(i, i + 1)} disabled={i === list.length - 1}>↓</button>
                <button type="button" className={btn} title="В конец" onClick={() => move(i, list.length - 1)} disabled={i === list.length - 1}>⤓</button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
