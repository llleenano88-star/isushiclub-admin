"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { saveZone, deleteZone, type ZoneInput } from "@/actions/zones";

type Zone = { id: string; name: string; color: string; polygon: [number, number][]; delivery_price: number | null; min_order: number | null; free_from: number | null; is_active: boolean; sort_order: number };

// Карта OpenFreeMap (MapLibre): без ключа и без лишних значков
const ML_JS = "https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js";
const ML_CSS = "https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.css";
const STYLE = "https://tiles.openfreemap.org/styles/positron";
function loadMapLibre(): Promise<any> {
  const w = window as any;
  if (w.maplibregl) return Promise.resolve(w.maplibregl);
  return new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${ML_CSS}"]`)) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = ML_CSS; document.head.appendChild(l); }
    const ex = document.querySelector(`script[src="${ML_JS}"]`);
    const done = () => (w.maplibregl ? resolve(w.maplibregl) : reject(new Error("maplibre")));
    if (ex) { ex.addEventListener("load", done); return; }
    const sc = document.createElement("script"); sc.src = ML_JS; sc.async = true; sc.onload = done; sc.onerror = () => reject(new Error("maplibre")); document.head.appendChild(sc);
  });
}
const lngLat = (p: [number, number]) => [p[1], p[0]];
const emptyFc = { type: "FeatureCollection", features: [] as any[] };

// Редактор многоугольника: клик по карте добавляет точку
function PolygonEditor({ points, setPoints, color, others }: { points: [number, number][]; setPoints: (p: [number, number][]) => void; color: string; others: Zone[] }) {
  const box = useRef<HTMLDivElement>(null); const map = useRef<any>(null); const ready = useRef(false);
  const pts = useRef(points); pts.current = points; const set = useRef(setPoints); set.current = setPoints; const col = useRef(color); col.current = color;
  const [err, setErr] = useState("");
  const render = () => {
    const m = map.current; if (!m || !ready.current) return;
    const p = pts.current; const feats: any[] = [];
    if (p.length >= 3) feats.push({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[...p.map(lngLat), lngLat(p[0])]] } });
    else if (p.length === 2) feats.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: p.map(lngLat) } });
    (m.getSource("draft") as any)?.setData({ type: "FeatureCollection", features: feats });
    (m.getSource("pts") as any)?.setData({ type: "FeatureCollection", features: p.map((q) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: lngLat(q) } })) });
    ["draft-fill", "draft-line", "pts"].forEach((id) => { if (!m.getLayer(id)) return; const prop = id === "draft-fill" ? "fill-color" : id === "draft-line" ? "line-color" : "circle-color"; m.setPaintProperty(id, prop, col.current); });
  };
  useEffect(() => {
    let dead = false;
    loadMapLibre().then((ml) => {
      if (dead || !box.current) return;
      const m = new ml.Map({ container: box.current, style: STYLE, center: points[0] ? lngLat(points[0]) : [50.15, 53.2], zoom: 11, attributionControl: false });
      map.current = m;
      m.addControl(new ml.AttributionControl({ compact: true, customAttribution: "OpenFreeMap © OpenMapTiles Data from OpenStreetMap" }));
      m.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
      m.on("load", () => {
        m.addSource("others", { type: "geojson", data: { type: "FeatureCollection", features: others.filter((z) => z.polygon?.length >= 3).map((z) => ({ type: "Feature", properties: { c: z.color }, geometry: { type: "Polygon", coordinates: [[...z.polygon.map(lngLat), lngLat(z.polygon[0])]] } })) } });
        m.addLayer({ id: "others-fill", type: "fill", source: "others", paint: { "fill-color": ["get", "c"], "fill-opacity": 0.08 } });
        m.addLayer({ id: "others-line", type: "line", source: "others", paint: { "line-color": ["get", "c"], "line-width": 1, "line-dasharray": [2, 2] } });
        m.addSource("draft", { type: "geojson", data: emptyFc });
        m.addLayer({ id: "draft-fill", type: "fill", source: "draft", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": col.current, "fill-opacity": 0.3 } });
        m.addLayer({ id: "draft-line", type: "line", source: "draft", paint: { "line-color": col.current, "line-width": 3 } });
        m.addSource("pts", { type: "geojson", data: emptyFc });
        m.addLayer({ id: "pts", type: "circle", source: "pts", paint: { "circle-radius": 6, "circle-color": col.current, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } });
        ready.current = true; render();
        if (pts.current.length >= 3) { const b = new ml.LngLatBounds(); pts.current.forEach((q) => b.extend(lngLat(q))); m.fitBounds(b, { padding: 40, duration: 0 }); }
      });
      m.on("click", (e: any) => set.current([...pts.current, [Number(e.lngLat.lat.toFixed(6)), Number(e.lngLat.lng.toFixed(6))]]));
    }).catch(() => setErr("Карта не загрузилась. Проверьте интернет и обновите страницу."));
    return () => { dead = true; if (map.current) { map.current.remove(); map.current = null; } ready.current = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(render, [points, color]); // eslint-disable-line react-hooks/exhaustive-deps
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
