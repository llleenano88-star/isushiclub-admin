import { requireAdmin } from "@/lib/auth";
import { asString, readSettings } from "@/lib/settings";
import { ContactsForm } from "./ContactsForm";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  await requireAdmin();
  const { map, error } = await readSettings([
    "contact_phone",
    "contact_email",
    "telegram",
    "vk",
    "whatsapp",
    "questions_title",
    "questions_text",
  ]);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-slate-800">Контакты</h1>
      {error ? (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          Не удалось загрузить настройки: {error}
        </div>
      ) : (
        <ContactsForm
          initial={{
            contact_phone: asString(map.contact_phone),
            contact_email: asString(map.contact_email),
            telegram: asString(map.telegram),
            vk: asString(map.vk),
            whatsapp: asString(map.whatsapp),
            questions_title: asString(map.questions_title),
            questions_text: asString(map.questions_text),
          }}
        />
      )}
    </div>
  );
}
