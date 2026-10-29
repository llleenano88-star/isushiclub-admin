"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { uploadImage } from "@/lib/upload";

// ---------- Доставка ----------

export type DeliveryInput = {
  delivery_price: number;
  free_delivery_from: number;
  min_order: number;
  delivery_iiko_id: string; // код позиции «Доставка» в iiko; пусто — доставка уходит только в комментарии
};

export async function updateDeliverySettings(input: DeliveryInput) {
  await requireAdmin();

  const fields: ["delivery_price" | "free_delivery_from" | "min_order", string][] = [
    ["delivery_price", "Стоимость доставки"],
    ["free_delivery_from", "Бесплатная доставка от суммы"],
    ["min_order", "Минимальная сумма заказа"],
  ];
  for (const [key, label] of fields) {
    const v = input[key];
    if (!Number.isFinite(v) || v < 0) {
      return { ok: false as const, error: `${label}: укажите число не меньше нуля` };
    }
  }

  const iikoId = String(input.delivery_iiko_id ?? "").trim();
  if (iikoId && !/^[0-9a-zA-Z-]{8,64}$/.test(iikoId)) {
    return { ok: false as const, error: "Код доставки в iiko: только буквы, цифры и дефисы (например, a1b2c3d4-…)" };
  }

  // Допущение: site_settings.key — уникальный ключ, value — jsonb (число сохраняется как число)
  const { error } = await createServiceClient()
    .from("site_settings")
    .upsert(
      [
        { key: "delivery_price", value: input.delivery_price },
        { key: "free_delivery_from", value: input.free_delivery_from },
        { key: "min_order", value: input.min_order },
        { key: "delivery_iiko_id", value: iikoId },
      ],
      { onConflict: "key" }
    );
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/delivery");
  revalidatePath("/");
  return { ok: true as const };
}

// ---------- Оформление сайта ----------

// Допущение: форма значений в site_settings (сверьте с тем, что читает сайт)
export type Banner = {
  image: string;
  link: string;
  image_mobile?: string; // картинка для телефона (необязательно)
};
export type About = {
  title: string;
  blocks: string[];
  list_title: string;
  items: string[];
  footer: string;
};
export type SiteSettingsInput = {
  banners: Banner[];
  category_images: Record<string, string>; // ключ — slug категории
  category_images_mobile?: Record<string, string>; // картинки категорий для телефона
  category_icons?: Record<string, string>; // значки категорий для окна «Меню»
  about: About;
  map_embed: string;
  delivery_time: string;
};

export async function uploadSiteImage(fd: FormData) {
  await requireAdmin();
  const file = fd.get("file");
  const folder = String(fd.get("folder") ?? "");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false as const, error: "Файл не выбран" };
  }
  if (folder !== "banners" && folder !== "categories") {
    return { ok: false as const, error: "Неверная папка загрузки" };
  }
  const res = await uploadImage(file, folder);
  if (!res.ok) return { ok: false as const, error: res.error };
  return { ok: true as const, url: res.url };
}

export async function updateSiteSettings(input: SiteSettingsInput) {
  await requireAdmin();

  const mapEmbed = input.map_embed.trim();
  if (mapEmbed && !/^https:\/\//i.test(mapEmbed)) {
    return { ok: false as const, error: "Ссылка карты должна начинаться с https://" };
  }

  const banners = input.banners
    .filter((b) => b.image.trim())
    .map((b) => ({ image: b.image.trim(), link: b.link.trim(), ...(b.image_mobile && b.image_mobile.trim() ? { image_mobile: b.image_mobile.trim() } : {}) }));

  const categoryImages: Record<string, string> = {};
  for (const [slug, url] of Object.entries(input.category_images)) {
    if (url && url.trim()) categoryImages[slug] = url.trim();
  }

  const categoryImagesMobile: Record<string, string> = {};
  for (const [slug, url] of Object.entries(input.category_images_mobile ?? {})) {
    if (url && url.trim()) categoryImagesMobile[slug] = url.trim();
  }

  const categoryIcons: Record<string, string> = {};
  for (const [slug, url] of Object.entries(input.category_icons ?? {})) {
    if (url && url.trim()) categoryIcons[slug] = url.trim();
  }

  const about: About = {
    title: input.about.title.trim(),
    blocks: input.about.blocks.map((s) => s.trim()).filter(Boolean),
    list_title: input.about.list_title.trim(),
    items: input.about.items.map((s) => s.trim()).filter(Boolean),
    footer: input.about.footer.trim(),
  };

  const { error } = await createServiceClient()
    .from("site_settings")
    .upsert(
      [
        { key: "banners", value: banners },
        { key: "category_images", value: categoryImages },
        // Картинки для телефона пишем только если форма их прислала, иначе существующие не трогаем
        ...(input.category_icons !== undefined ? [{ key: "category_icons", value: categoryIcons }] : []),
        ...(input.category_images_mobile !== undefined ? [{ key: "category_images_mobile", value: categoryImagesMobile }] : []),
        { key: "about", value: about },
        { key: "map_embed", value: mapEmbed },
        { key: "delivery_time", value: input.delivery_time.trim() },
      ],
      { onConflict: "key" }
    );
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/design");
  revalidatePath("/");
  return { ok: true as const };
}
