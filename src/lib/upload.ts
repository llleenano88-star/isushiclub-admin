import { createServiceClient } from "@/lib/supabase/server";

export const IMAGE_BUCKET = "product-images";
const MAX_SIZE = 5 * 1024 * 1024;

// Загружает картинку в Storage (bucket product-images) и возвращает публичный URL.
// Вызывать только из server actions после requireAdmin().
export async function uploadImage(
  file: File,
  folder: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Файл должен быть изображением" };
  }
  if (file.size > MAX_SIZE) {
    return { ok: false, error: "Размер изображения не должен превышать 5 МБ" };
  }

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const storage = createServiceClient().storage.from(IMAGE_BUCKET);
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await storage.upload(path, buffer, { contentType: file.type, upsert: false });
  if (error) return { ok: false, error: `Не удалось загрузить фото: ${error.message}` };

  const { data } = storage.getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}
