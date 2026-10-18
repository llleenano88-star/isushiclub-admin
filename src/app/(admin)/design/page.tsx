import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { DesignForm } from "./DesignForm";

export const dynamic = "force-dynamic";

// Значение из site_settings может прийти объектом или JSON-строкой
function parse(v: unknown): any {
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }
  return v;
}

function str(v: unknown): string {
  const p = parse(v);
  return typeof p === "string" ? p : "";
}

function strList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}

export default async function DesignPage() {
  await requireAdmin();
  const db = createServiceClient();

  const { data, error } = await db
    .from("site_settings")
    .select("key, value")
    .in("key", ["banners", "category_images", "about", "map_embed", "delivery_time"]);

  const { data: cats } = await db
    .from("categories")
    .select("id, name, slug, sort_order")
    .order("sort_order", { ascending: true });

  const map: Record<string, unknown> = {};
  for (const row of (data ?? []) as any[]) map[row.key] = row.value;

  const rawBanners = parse(map.banners);
  const banners = (Array.isArray(rawBanners) ? rawBanners : [])
    .map((b: any) => ({
      image: String(b?.image ?? b?.url ?? b?.src ?? ""),
      link: String(b?.link ?? b?.href ?? ""),
    }))
    .filter((b: { image: string }) => b.image);

  const rawImages = parse(map.category_images);
  const categoryImages: Record<string, string> = {};
  if (rawImages && typeof rawImages === "object" && !Array.isArray(rawImages)) {
    for (const [k, v] of Object.entries(rawImages)) {
      if (typeof v === "string") categoryImages[k] = v;
    }
  }

  const rawAbout = parse(map.about);
  const aboutObj = rawAbout && typeof rawAbout === "object" ? (rawAbout as any) : {};
  const about = {
    title: typeof aboutObj.title === "string" ? aboutObj.title : "",
    blocks: strList(aboutObj.blocks),
    list_title: typeof aboutObj.list_title === "string" ? aboutObj.list_title : "",
    items: strList(aboutObj.items),
    footer: typeof aboutObj.footer === "string" ? aboutObj.footer : "",
  };

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-slate-800">Оформление сайта</h1>
      {error ? (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          Не удалось загрузить настройки: {error.message}
        </div>
      ) : (
        <DesignForm
          initial={{
            banners,
            category_images: categoryImages,
            about,
            map_embed: str(map.map_embed),
            delivery_time: str(map.delivery_time),
          }}
          categories={(cats ?? []) as { id: string | number; name: string; slug: string }[]}
        />
      )}
    </div>
  );
}
