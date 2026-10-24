"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

export type ContactsInput = {
  contact_phone: string;
  contact_email: string;
  telegram: string;
  vk: string;
  whatsapp: string;
  questions_title: string;
  questions_text: string;
};

export async function updateContacts(input: ContactsInput) {
  await requireAdmin();

  const v = {
    contact_phone: input.contact_phone.trim(),
    contact_email: input.contact_email.trim(),
    telegram: input.telegram.trim(),
    vk: input.vk.trim(),
    whatsapp: input.whatsapp.trim(),
    questions_title: input.questions_title.trim().slice(0, 100),
    questions_text: input.questions_text.trim().slice(0, 500),
  };

  if (v.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.contact_email)) {
    return { ok: false as const, error: "Некорректный email" };
  }
  const links: [string, string][] = [
    [v.telegram, "Telegram"],
    [v.vk, "VK"],
    [v.whatsapp, "WhatsApp"],
  ];
  for (const [value, label] of links) {
    if (value && !/^https?:\/\//i.test(value)) {
      return { ok: false as const, error: `${label}: ссылка должна начинаться с https://` };
    }
  }

  const { error } = await createServiceClient()
    .from("site_settings")
    .upsert(
      (Object.keys(v) as (keyof typeof v)[]).map((key) => ({ key, value: v[key] })),
      { onConflict: "key" }
    );
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/contacts");
  revalidatePath("/");
  return { ok: true as const };
}
