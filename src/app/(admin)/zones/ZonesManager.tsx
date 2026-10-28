"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { saveZone, deleteZone, type ZoneInput } from "@/actions/zones";

type Zone = { id: string; name: string; color: string; polygon: [number, number][]; delivery_price: number | null; min_order: number | null; free_from: number | null; is_active: boolean; sort_order: number };

const LEAFLET_JS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
const LEAFLET_CSS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
function loadLeaflet(): Promise<any> {
  const w = window as any;
  if (w.L) return Promise.resolve(w.L);
  return new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = LEAFLET_CSS; document.head.appendChild(l); }
    const ex = document.querySelector(`script[src="${LEAFLET_JS}"]`);
    const done = () => (w.L ? resolve(w.L) : reject(new Error("leaflet")));
    if (ex) { ex.addEventListener("load", done); return; }
    const s = document.createElement("script"); s.src = LEAFLET_JS; s.async = true; s.onload = done; s.onerror = () => reject(new Error("leaflet")); document.head.appendChild(s);
  });
}

// Редактор многоугольника: клик по карте добавляет точку
function PolygonEditor({ points, setPoints, color, others }: { points: [number, number][]; setPoints: (p: [number, number][]) => void; color: string; others: Zone[] }) {
  const box = useRef<HTMLDivElement>(null); const map = useRef<any>(null); const L = useRef<any>(null); const layer = useRef<any>(null);
  const pts = useRef(points); pts.current = points; const set = useRef(setPoints); set.current = setPoints;
  const [err, setErr] = useState("");
  const draw = () => {
    if (!map.current || !L.current) return;
    if (layer.current) layer.current.remove();
    const g = L.current.layerGroup().addTo(map.current); layer.current = g;
    if (pts.current.length >= 3) L.current.polygon(pts.current, { color, weight: 3, fillColor: color, fillOpacity: 0.3 }).addTo(g);
    else if (pts.current.length >= 2) L.current.polyline(pts.current, { color, weight: 3 }).addTo(g);
    pts.current.forEach((p) => L.current.circleMarker(p, { radius: 5, color: "#fff", weight: 2, fillColor: color, fillOpacity: 1 }).addTo(g));
  };
  useEffect(() => {
    let dead = false;
    loadLeaflet().then((Lf) => {
      if (dead || !box.current) return;
      L.current = Lf;
      const m = Lf.map(box.current, { scrollWheelZoom: true }).setView(points[0] ?? [53.2, 50.15], 12); map.current = m;
      Lf.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", { maxZoom: 19, subdomains: "abcd", attribution: "© OpenStreetMap, © CARTO" }).addTo(m);
      others.forEach((z) => { if (z.polygon?.length >= 3) Lf.polygon(z.polygon, { color: z.color, weight: 1, dashArray: "4", fillOpacity: 0.08, interactive: false }).addTo(m); });
      if (points.length >= 3) m.fitBounds(Lf.polygon(points).getBounds(), { padding: [30, 30] });
      m.on("click", (e: any) => set.current([...pts.current, [Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6))]]));
      draw(); setTimeout(() => m.invalidateSize(), 200);
    }).catch(() => setErr("Карта не загрузилась. Проверьте интернет и обновите страницу."));
    return () => { dead = true; if (map.current) { map.current.remove(); map.current = null; } };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(draw, [points, color]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      <div ref={box} className="h-80 w-full rounded-md border border-slate-300 bg-slate-100" />
      {err && <p className="mt-1 text-sm text-red-600">{err}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-500">Кликайте по карте, чтобы поставить углы зоны (минимум 3). Точек: {points.length}</span>
        <button type="button" className="btn-secondary" onClick={() => setPoints(points.slice(0, -1))} disabled={!points.length}>Убрать последнюю</button>
        <button type="button" className="btn-secondary" onClick={() => setPoints([])} disabled={!points.length}>Стереть всё</button>
      </div>
    </div>
  );
}

export function ZonesManager({ initial }: { initial: Zone[] }) {
  const toast = useToast(); const router = useRouter(); const [pending, startTransition] = useTransition();
  const [edit, setEdit] = useState<Zone | "new" | null>(null);
  const [f, setF] = useState<ZoneInput>({ name: "", color: "#d81b7a", polygon: [], delivery_price: "", min_order: "", free_from: "", is_active: true, sort_order: 0 });
  const openForm = (z: Zone | "new") => {
    setF(z === "new" ? { name: "", color: "#d81b7a", polygon: [], delivery_price: "", min_order: "", free_from: "", is_active: true, sort_order: initial.length + 1 }
      : { name: z.name, color: z.color, polygon: z.polygon ?? [], delivery_price: z.delivery_price == null ? "" : String(z.delivery_price), min_order: z.min_order == null ? "" : String(z.min_order), free_from: z.free_from == null ? "" : String(z.free_from), is_active: z.is_active, sort_order: z.sort_order ?? 0 });
    setEdit(z);
  };
  const save = () => startTransition(async () => {
    const r = await saveZone(edit === "new" || !edit ? null : edit.id, f);
    if (!r.ok) { toast(r.error, "error"); return; }
    toast("Сохранено"); setEdit(null); router.refresh();
  });
  const remove = (z: Zone) => { if (!confirm(`Удалить зону «${z.name}»?`)) return; startTransition(async () => { const r = await deleteZone(z.id); if (!r.ok) toast(r.error, "error"); else { toast("Удалено"); router.refresh(); } }); };
  const rub = (n: number | null) => (n == null ? "как в «Доставка»" : `${n} ₽`);
  return (
    <div>
      <button className="btn btn-primary mb-4" onClick={() => openForm("new")}>+ Добавить зону</button>
      {!initial.length ? <p className="rounded-md bg-white p-6 text-sm text-slate-500">Зон пока нет. Добавьте первую: нарисуйте её на карте.</p> : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="px-4 py-2">Зона</th><th className="px-4 py-2">Цена доставки</th><th className="px-4 py-2">Мин. заказ</th><th className="px-4 py-2">Бесплатно от</th><th className="px-4 py-2">Статус</th><th /></tr></thead>
            <tbody>
              {initial.map((z) => (
                <tr key={z.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium"><span className="mr-2 inline-block h-3 w-3 rounded-full align-middle" style={{ background: z.color }} />{z.name}</td>
                  <td className="px-4 py-2">{rub(z.delivery_price)}</td><td className="px-4 py-2">{rub(z.min_order)}</td><td className="px-4 py-2">{rub(z.free_from)}</td>
                  <td className="px-4 py-2">{z.is_active ? "Показывается" : "Скрыта"}</td>
                  <td className="px-4 py-2 text-right"><button className="btn-secondary mr-2" onClick={() => openForm(z)}>Изменить</button><button className="btn-danger" onClick={() => remove(z)} disabled={pending}>Удалить</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && (
        <Modal title={edit === "new" ? "Новая зона" : "Изменить зону"} onClose={() => setEdit(null)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <label className="block text-sm"><span className="label">Название</span><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Например: Центр" /></label>
              <label className="block text-sm"><span className="label">Цвет</span><input type="color" className="h-10 w-16 rounded border border-slate-300" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} /></label>
            </div>
            <PolygonEditor points={f.polygon} setPoints={(p) => setF((o) => ({ ...o, polygon: p }))} color={f.color} others={initial.filter((z) => edit === "new" || z.id !== edit.id)} />
            <div className="grid grid-cols-3 gap-3">
              <label className="block text-sm"><span className="label">Цена доставки, ₽</span><input type="number" min={0} className="input" value={f.delivery_price} onChange={(e) => setF({ ...f, delivery_price: e.target.value })} placeholder="как в «Доставка»" /></label>
              <label className="block text-sm"><span className="label">Мин. заказ, ₽</span><input type="number" min={0} className="input" value={f.min_order} onChange={(e) => setF({ ...f, min_order: e.target.value })} placeholder="как в «Доставка»" /></label>
              <label className="block text-sm"><span className="label">Бесплатно от, ₽</span><input type="number" min={0} className="input" value={f.free_from} onChange={(e) => setF({ ...f, free_from: e.target.value })} placeholder="как в «Доставка»" /></label>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} /> Показывать на сайте</label>
              <label className="flex items-center gap-2">Порядок <input type="number" className="input w-20" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: Number(e.target.value) })} /></label>
            </div>
            <div className="flex justify-end gap-2"><button className="btn-secondary" onClick={() => setEdit(null)}>Отмена</button><button className="btn btn-primary" onClick={save} disabled={pending}>{pending ? "Сохранение…" : "Сохранить"}</button></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
