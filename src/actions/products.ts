"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

const BUCKET = "product-images";

type SavedVariant = { label: string; price: number; sizeId?: string; iiko_id?: string };

export async function saveProduct(formData: FormData) {
  await requireAdmin();
  const db = createServiceClient();

  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  if (!name) return { ok: false as const, error: "Укажите название" };

  let variants: SavedVariant[] = [];
  try {
    const raw = JSON.parse(String(formData.get("variants") || "[]"));
    variants = (Array.isArray(raw) ? raw : [])
      .map((v: any) => {
        const out: SavedVariant = { label: String(v.label ?? "").trim(), price: Number(v.price) || 0 };
        // iiko_id варианта — отдельный товар в iiko, тогда sizeId не нужен и не сохраняется.
        // Иначе сохраняем sizeId (размер одного товара из iiko), если он есть.
        const variantIikoId = String(v.iiko_id ?? "").trim();
        if (variantIikoId) {
          out.iiko_id = variantIikoId;
        } else {
          const sizeId = v.sizeId ? String(v.sizeId).trim() : "";
          if (sizeId) out.sizeId = sizeId;
        }
        return out;
      })
      .filter((v) => v.label || v.price);
  } catch {
    return { ok: false as const, error: "Некорректные варианты" };
  }

  const record: Record<string, any> = {
    name,
    description: String(formData.get("description") || "").trim() || null,
    category_id: String(formData.get("category_id") || "") || null,
    is_available: formData.get("is_available") === "on",
    is_new: formData.get("is_new") === "on",
    iiko_id: String(formData.get("iiko_id") || "").trim() || null,
    variants,
  };

  // Выбор у товара (соус, ролл). Меняем только если форма прислала это поле.
  let optionsJson: { title: string; choices: string[] }[] | null = null;
  if (formData.has("options")) {
    try {
      const raw = JSON.parse(String(formData.get("options") || "[]"));
      optionsJson = (Array.isArray(raw) ? raw : [])
        .map((g: any) => ({
          title: String(g?.title ?? "").trim(),
          choices: (Array.isArray(g?.choices) ? g.choices : []).map((c: unknown) => String(c ?? "").trim()).filter(Boolean),
        }))
        .filter((g) => g.choices.length > 0);
    } catch {
      return { ok: false as const, error: "Некорректный выбор у товара" };
    }
    record.options = optionsJson;
  }

  // Перчик «острый»: меняем только если форма прислала маркер (галочка без отметки в форму не попадает)
  if (formData.get("spicy_form") === "1") {
    record.is_spicy = formData.get("is_spicy") === "on";
    record.is_hit = formData.get("is_hit") === "on";
  }

  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith("image/")) return { ok: false as const, error: "Файл должен быть изображением" };
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext || "jpg"}`;
    const { error: upErr } = await db.storage.from(BUCKET).upload(path, file, { contentType: file.type });
    if (upErr) return { ok: false as const, error: "Не удалось загрузить фото: " + upErr.message };
    record.image_url = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  const write = (rec: Record<string, any>) =>
    id ? db.from("products").update(rec).eq("id", id) : db.from("products").insert(rec);
  let { error } = await write(record);
  if (error && error.code === "42703" && ("options" in record || "is_spicy" in record || "is_hit" in record)) {
    // Новых колонок ещё нет (не выполнены миграции 009/010): сохраняем остальное, чтобы ничего не потерялось
    if ((optionsJson && optionsJson.length) || record.is_spicy || record.is_hit) {
      return { ok: false as const, error: "Сначала выполните миграции 009, 010 и 011 в Supabase (папка supabase/migrations)" };
    }
    const { options: _o, is_spicy: _s, is_hit: _h, ...rest } = record;
    ({ error } = await write(rest));
  }
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/products");
  return { ok: true as const };
}

export async function setProductsAvailable(ids: (string | number)[], value: boolean) {
  await requireAdmin();
  if (!ids.length) return { ok: true as const };
  const { error } = await createServiceClient().from("products").update({ is_available: value }).in("id", ids);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/products");
  return { ok: true as const };
}

export async function deleteProducts(ids: (string | number)[]) {
  await requireAdmin();
  if (!ids.length) return { ok: true as const };
  const { error } = await createServiceClient().from("products").delete().in("id", ids);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/products");
  return { ok: true as const };
}
