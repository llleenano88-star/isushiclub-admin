"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/Toast";
import { updateWorkSettings, type WorkInput } from "@/actions/work";

const DAYS: { n: number; label: string }[] = [
  { n: 1, label: "Понедельник" },
  { n: 2, label: "Вторник" },
  { n: 3, label: "Среда" },
  { n: 4, label: "Четверг" },
  { n: 5, label: "Пятница" },
  { n: 6, label: "Суббота" },
  { n: 7, label: "Воскресенье" },
];

export function WorkForm({ initial }: { initial: WorkInput }) {
  // Допущение: useToast() возвращает функцию toast(msg, "error"?)
  const toast = useToast();
  const [from, setFrom] = useState(initial.work_time_from);
  const [to, setTo] = useState(initial.work_time_to);
  // Отмеченные дни — выходные; в site_settings сохраняются рабочие (work_days)
  const [weekends, setWeekends] = useState<number[]>(
    DAYS.map((d) => d.n).filter((n) => !initial.work_days.includes(n))
  );
  const [pending, startTransition] = useTransition();

  function toggleDay(n: number) {
    setWeekends((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  }

  function save() {
    const payload: WorkInput = {
      work_time_from: from,
      work_time_to: to,
      work_days: DAYS.map((d) => d.n).filter((n) => !weekends.includes(n)),
    };
    startTransition(async () => {
      const res = await updateWorkSettings(payload);
      if (!res.ok) toast(res.error, "error");
      else toast("Сохранено");
    });
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="mb-4 text-base font-semibold text-slate-800">Время работы и выходные</h2>
      <div className="grid max-w-md grid-cols-2 gap-4">
        <label className="block text-sm">
          <span className="label">Открытие</span>
          <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} className="input w-full" />
        </label>
        <label className="block text-sm">
          <span className="label">Закрытие</span>
          <input type="time" value={to} onChange={(e) => setTo(e.target.value)} className="input w-full" />
        </label>
      </div>
      <div className="mt-4 text-sm">
        <span className="label">Выходные дни</span>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {DAYS.map((d) => (
            <label key={d.n} className="flex items-center gap-2 text-slate-700">
              <input
                type="checkbox"
                checked={weekends.includes(d.n)}
                onChange={() => toggleDay(d.n)}
                className="h-4 w-4 rounded border-slate-300"
              />
              {d.label}
            </label>
          ))}
        </div>
        <span className="mt-1 block text-xs text-slate-500">Отметьте дни, в которые магазин не работает.</span>
      </div>
      <div className="mt-5 flex justify-end">
        <button type="button" onClick={save} disabled={pending} className="btn btn-primary disabled:opacity-50">
          {pending ? "Сохранение…" : "Сохранить"}
        </button>
      </div>
    </section>
  );
}
