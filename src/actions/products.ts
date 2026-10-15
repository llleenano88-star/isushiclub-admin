"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

const BUCKET = "product-images";

export async function saveProduct(formData: FormData) {
  await requireAdmin();
  const db = createServiceClient();

  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  if (!name) return { ok: false as const, error: "Укажите название" };

  let variants: { label: string; price: number }[] = [];
  try {
    const raw = JSON.parse(String(formData.get("variants") || "[]"));
    variants = (Array.isArray(raw) ? raw : [])
      .map((v: any) => ({ label: String(v.label ?? "").trim(), price: Number(v.price) || 0 }))
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

  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith("image/")) return { ok: false as const, error: "Файл должен быть изображением" };
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext || "jpg"}`;
    const { error: upErr } = await db.storage.from(BUCKET).upload(path, file, { contentType: file.type });
    if (upErr) return { ok: false as const, error: "Не удалось загрузить фото: " + upErr.message };
    record.image_url = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  const { error } = id
    ? await db.from("products").update(record).eq("id", id)
    : await db.from("products").insert(record);
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
