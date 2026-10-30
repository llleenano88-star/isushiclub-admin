"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/Toast";
import { updateOrderTimeSettings, type OrderTimeInput } from "@/actions/ordertime";

export function OrderTimeForm({ initial }: { initial: OrderTimeInput }) {
  const toast = useToast();
  const [f, setF] = useState<OrderTimeInput>(initial);
  const [pending, startTransition] = useTransition();
  const num = (k: "pickup_lead_min" | "pickup_lead_max" | "delivery_lead_min" | "delivery_lead_max", label: string) => (
    <label className="block text-sm">
      <span className="label">{label}</span>
      <div className="relative">
        <input type="number" min={0} max={600} value={f[k]} onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} className="input w-full pr-12" />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">мин</span>
      </div>
    </label>
  );
  function save() {
    startTransition(async () => {
      const res = await updateOrderTimeSettings(f);
      if (!res.ok) toast(res.error, "error"); else toast("Сохранено");
    });
  }
  return (
    <div className="mt-6 max-w-xl rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="mb-1 text-lg font-semibold text-slate-800">Время заказа</h2>
      <p className="mb-4 text-sm text-slate-500">Через сколько минут можно получить заказ. Клиент не сможет выбрать время раньше минимального срока.</p>
      <div className="grid grid-cols-2 gap-4">
        {num("pickup_lead_min", "Самовывоз: от")}{num("pickup_lead_max", "Самовывоз: до")}
        {num("delivery_lead_min", "Доставка: от")}{num("delivery_lead_max", "Доставка: до")}
      </div>
      <label className="mt-4 block text-sm"><span className="label">Время на дорогу при доставке «ко времени»</span>
        <div className="relative"><input type="number" min={0} max={180} className="input w-full pr-12" value={f.delivery_travel_min} onChange={(e) => setF({ ...f, delivery_travel_min: Number(e.target.value) })} /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">мин</span></div></label>
      <p className="mt-1 text-xs text-slate-500">Если клиент заказал доставку к 18:00, а здесь 40 минут, кухня получит «готовность к 17:20». Для самовывоза готовим точно ко времени клиента.</p>
      <p className="mt-2 text-xs text-slate-500">«От» — минимальный срок для выбора времени, «от–до» показывается клиенту как «через 30–40 мин».</p>
      <div className="mt-4 grid grid-cols-3 gap-4">
        <label className="block text-sm"><span className="label">Шаг времени</span>
          <select className="input w-full" value={f.slot_step} onChange={(e) => setF({ ...f, slot_step: Number(e.target.value) })}>{[5, 10, 15, 20, 30].map((n) => <option key={n} value={n}>{n} мин</option>)}</select></label>
        <label className="block text-sm"><span className="label">Работаем с</span><input type="time" className="input w-full" value={f.work_from} onChange={(e) => setF({ ...f, work_from: e.target.value })} /></label>
        <label className="block text-sm"><span className="label">до</span><input type="time" className="input w-full" value={f.work_to} onChange={(e) => setF({ ...f, work_to: e.target.value })} /></label>
      </div>
      <p className="mt-2 text-xs text-slate-500">Часы работы необязательны. Если они заданы, до открытия кнопка «Оформить заказ» на сайте неактивна («Ресторан ещё закрыт…»).</p>
      <label className="mt-4 block text-sm"><span className="label">Не принимать заказы за … минут до закрытия</span>
        <div className="relative"><input type="number" min={0} max={240} className="input w-full pr-12" value={f.close_cutoff_min} onChange={(e) => setF({ ...f, close_cutoff_min: Number(e.target.value) })} /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">мин</span></div></label>
      <p className="mt-1 text-xs text-slate-500">Например, 30: при закрытии в 22:00 заказы перестанут приниматься в 21:30 («Приём заказов на сегодня завершён…»). 0 = принимаем до самого закрытия.</p>
      <label className="mt-4 block text-sm"><span className="label">Город для поиска адреса на карте</span><input className="input w-full" value={f.site_city} onChange={(e) => setF({ ...f, site_city: e.target.value })} placeholder="Самара" /></label>
      <label className="mt-4 block text-sm"><span className="label">Часовой пояс (для акций по времени)</span>
        <input className="input w-full" value={f.site_tz} onChange={(e) => setF({ ...f, site_tz: e.target.value })} placeholder="Europe/Samara" /></label>
      <label className="mt-4 block text-sm"><span className="label">Текст над картой зон доставки</span>
        <textarea rows={2} maxLength={300} className="input w-full" value={f.zone_text} onChange={(e) => setF({ ...f, zone_text: e.target.value })} placeholder="Есть вопросы по поводу зоны доставки? Позвоните 202-10-20" /></label>
      <div className="mt-5 flex justify-end"><button type="button" onClick={save} disabled={pending} className="btn btn-primary disabled:opacity-50">{pending ? "Сохранение…" : "Сохранить"}</button></div>
    </div>
  );
}
