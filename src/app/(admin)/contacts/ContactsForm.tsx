"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/Toast";
import { updateContacts, type ContactsInput } from "@/actions/contacts";

export function ContactsForm({ initial }: { initial: ContactsInput }) {
  // Допущение: useToast() возвращает функцию toast(msg, "error"?)
  const toast = useToast();
  const [form, setForm] = useState<ContactsInput>(initial);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await updateContacts(form);
      if (!res.ok) toast(res.error, "error");
      else toast("Сохранено");
    });
  }

  const field = (
    key: keyof ContactsInput,
    label: string,
    placeholder: string,
    hint?: string,
    type = "text"
  ) => (
    <label className="block text-sm">
      <span className="label">{label}</span>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="input w-full"
      />
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );

  return (
    <div className="max-w-xl rounded-lg border border-slate-200 bg-white p-5">
      <div className="space-y-4">
        {field("contact_phone", "Телефон для связи", "+7 900 000-00-00", "Показывается клиенту под корзиной.")}
        {field("contact_email", "Email", "info@isushiclub.ru", undefined, "email")}
        {field("telegram", "Telegram (ссылка)", "https://t.me/...")}
        {field("vk", "VK (ссылка)", "https://vk.com/...")}
        {field("whatsapp", "WhatsApp (ссылка)", "https://wa.me/...")}
      </div>
      <div className="mt-5 flex justify-end">
        <button type="button" onClick={save} disabled={pending} className="btn btn-primary disabled:opacity-50">
          {pending ? "Сохранение…" : "Сохранить"}
        </button>
      </div>
    </div>
  );
}
