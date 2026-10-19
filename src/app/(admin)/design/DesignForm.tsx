"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/Toast";
import { ImageCropModal } from "@/components/ImageCropModal";
import { SPECS, ALLOWED_TYPES, validateSource, type CropSpec } from "@/lib/imageCrop";
import {
  updateSiteSettings,
  uploadSiteImage,
  type Banner,
  type About,
  type SiteSettingsInput,
} from "@/actions/settings";

type Category = { id: string | number; name: string; slug: string };

// Если вставили целиком <iframe ...>, достаём src
function extractSrc(value: string): string {
  const m = value.match(/src\s*=\s*["']([^"']+)["']/i);
  return (m ? m[1] : value).trim();
}

const card = "mb-5 rounded-lg border border-slate-200 bg-white p-5";

export function DesignForm({
  initial,
  categories,
}: {
  initial: SiteSettingsInput;
  categories: Category[];
}) {
  // Допущение: useToast() возвращает функцию toast(msg, "error"?)
  const toast = useToast();
  const [banners, setBanners] = useState<Banner[]>(initial.banners);
  const [catImages, setCatImages] = useState<Record<string, string>>(initial.category_images);
  const [about, setAbout] = useState<About>(initial.about);
  const [mapEmbed, setMapEmbed] = useState(initial.map_embed);
  const [deliveryTime, setDeliveryTime] = useState(initial.delivery_time);

  const [uploading, setUploading] = useState<string | null>(null);
  const [cropReq, setCropReq] = useState<{ file: File; spec: CropSpec; title: string; done: (f: File) => void } | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  async function upload(file: File, folder: "banners" | "categories"): Promise<string | null> {
    const fd = new FormData();
    fd.set("file", file);
    fd.set("folder", folder);
    const res = await uploadSiteImage(fd);
    if (!res.ok) {
      toast(res.error, "error");
      return null;
    }
    return res.url;
  }

  // ---------- баннеры ----------

  // Выбор файла -> проверка -> редактор обрезки -> загрузка обрезанного файла
  function askCrop(file: File | null, spec: CropSpec, title: string, done: (f: File) => void) {
    if (!file) return;
    const err = validateSource(file);
    if (err) {
      toast(err, "error");
      return;
    }
    setCropReq({ file, spec, title, done });
  }

  function addBanner(file: File | null) {
    askCrop(file, SPECS.banner, "Обрезка баннера (3:1)", async (cropped) => {
      setUploading("banner");
      const url = await upload(cropped, "banners");
      setUploading(null);
      if (url) setBanners((prev) => [...prev, { image: url, link: "" }]);
    });
  }

  function replaceBanner(index: number, file: File | null) {
    askCrop(file, SPECS.banner, "Обрезка баннера (3:1)", async (cropped) => {
      setUploading(`banner-${index}`);
      const url = await upload(cropped, "banners");
      setUploading(null);
      if (url) setBanners((prev) => prev.map((b, i) => (i === index ? { ...b, image: url } : b)));
    });
  }

  function removeBanner(index: number) {
    if (!confirm("Удалить баннер?")) return;
    setBanners((prev) => prev.filter((_, i) => i !== index));
  }

  function dropBanner(target: number) {
    if (dragIdx === null || dragIdx === target) {
      setDragIdx(null);
      setOverIdx(null);
      return;
    }
    setBanners((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(target, 0, moved);
      return next;
    });
    setDragIdx(null);
    setOverIdx(null);
  }

  // ---------- обложки категорий ----------

  function setCover(slug: string, file: File | null) {
    askCrop(file, SPECS.cover, "Обрезка обложки категории (3:1)", async (cropped) => {
      setUploading(`cat-${slug}`);
      const url = await upload(cropped, "categories");
      setUploading(null);
      if (url) setCatImages((prev) => ({ ...prev, [slug]: url }));
    });
  }

  function clearCover(slug: string) {
    setCatImages((prev) => {
      const next = { ...prev };
      delete next[slug];
      return next;
    });
  }

  // ---------- «О нас» ----------

  function setList(key: "blocks" | "items", index: number, value: string) {
    setAbout((a) => ({ ...a, [key]: a[key].map((s, i) => (i === index ? value : s)) }));
  }
  function addToList(key: "blocks" | "items") {
    setAbout((a) => ({ ...a, [key]: [...a[key], ""] }));
  }
  function removeFromList(key: "blocks" | "items", index: number) {
    setAbout((a) => ({ ...a, [key]: a[key].filter((_, i) => i !== index) }));
  }

  // ---------- сохранение ----------

  function save() {
    const payload: SiteSettingsInput = {
      banners,
      category_images: catImages,
      about,
      map_embed: extractSrc(mapEmbed),
      delivery_time: deliveryTime,
    };
    startTransition(async () => {
      const res = await updateSiteSettings(payload);
      if (!res.ok) toast(res.error, "error");
      else {
        setMapEmbed(payload.map_embed);
        toast("Сохранено");
      }
    });
  }

  return (
    <div className="max-w-4xl">
      {/* Баннеры */}
      <section className={card}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">Баннеры</h2>
          <label className="btn btn-secondary cursor-pointer">
            {uploading === "banner" ? "Загрузка…" : "+ Добавить баннер"}
            <input
              type="file"
              accept={ALLOWED_TYPES.join(",")}
              className="hidden"
              onChange={(e) => {
                addBanner(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {banners.length === 0 ? (
          <p className="text-sm text-slate-500">Баннеров пока нет</p>
        ) : (
          <ul className="space-y-2">
            {banners.map((b, i) => (
              <li
                key={`${b.image}-${i}`}
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverIdx(i);
                }}
                onDrop={() => dropBanner(i)}
                onDragEnd={() => {
                  setDragIdx(null);
                  setOverIdx(null);
                }}
                className={`flex items-center gap-3 rounded-md border border-slate-200 p-2 ${
                  dragIdx === i ? "opacity-40" : ""
                } ${overIdx === i && dragIdx !== i ? "bg-slate-100" : "bg-white"}`}
              >
                <span className="cursor-grab px-1 text-slate-400" title="Перетащите, чтобы изменить порядок">
                  ⠿
                </span>
                <span className="w-6 text-sm text-slate-500">{i + 1}</span>
                <img src={b.image} alt="" className="h-16 w-32 rounded object-cover bg-slate-100" />
                <input
                  type="text"
                  value={b.link}
                  onChange={(e) =>
                    setBanners((prev) =>
                      prev.map((x, idx) => (idx === i ? { ...x, link: e.target.value } : x))
                    )
                  }
                  placeholder="Ссылка (например, /catalog/rolls)"
                  className="input flex-1"
                />
                <label className="btn btn-secondary cursor-pointer">
                  {uploading === `banner-${i}` ? "…" : "Заменить"}
                  <input
                    type="file"
                    accept={ALLOWED_TYPES.join(",")}
                    className="hidden"
                    onChange={(e) => {
                      replaceBanner(i, e.target.files?.[0] ?? null);
                      e.target.value = "";
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => removeBanner(i)}
                  title="Удалить"
                  aria-label="Удалить"
                  className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700"
                >
                  🗑️
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Обложки категорий */}
      <section className={card}>
        <h2 className="mb-4 text-base font-semibold text-slate-800">Обложки категорий</h2>
        {categories.length === 0 ? (
          <p className="text-sm text-slate-500">Категорий пока нет</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {categories.map((c) => {
              const url = catImages[c.slug];
              return (
                <li key={String(c.id)} className="flex items-center gap-3 py-2">
                  <div className="h-14 w-24 overflow-hidden rounded bg-slate-100">
                    {url && <img src={url} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <span className="flex-1 text-sm font-medium text-slate-900">{c.name}</span>
                  <label className="btn btn-secondary cursor-pointer">
                    {uploading === `cat-${c.slug}` ? "Загрузка…" : url ? "Заменить" : "Загрузить"}
                    <input
                      type="file"
                      accept={ALLOWED_TYPES.join(",")}
                      className="hidden"
                      onChange={(e) => {
                        setCover(c.slug, e.target.files?.[0] ?? null);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {url && (
                    <button type="button" onClick={() => clearCover(c.slug)} className="btn btn-secondary">
                      Убрать
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* О нас */}
      <section className={card}>
        <h2 className="mb-4 text-base font-semibold text-slate-800">Блок «О нас»</h2>
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="label">Заголовок</span>
            <input
              type="text"
              value={about.title}
              onChange={(e) => setAbout((a) => ({ ...a, title: e.target.value }))}
              className="input w-full"
            />
          </label>

          <div className="text-sm">
            <span className="label">Блоки текста</span>
            <div className="space-y-2">
              {about.blocks.map((t, i) => (
                <div key={i} className="flex gap-2">
                  <textarea
                    value={t}
                    onChange={(e) => setList("blocks", i, e.target.value)}
                    rows={3}
                    className="input flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeFromList("blocks", i)}
                    title="Удалить блок"
                    aria-label="Удалить блок"
                    className="self-start rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => addToList("blocks")} className="btn btn-secondary mt-2">
              + Добавить блок
            </button>
          </div>

          <label className="block text-sm">
            <span className="label">Заголовок списка</span>
            <input
              type="text"
              value={about.list_title}
              onChange={(e) => setAbout((a) => ({ ...a, list_title: e.target.value }))}
              className="input w-full"
            />
          </label>

          <div className="text-sm">
            <span className="label">Пункты списка</span>
            <div className="space-y-2">
              {about.items.map((t, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={t}
                    onChange={(e) => setList("items", i, e.target.value)}
                    className="input flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeFromList("items", i)}
                    title="Удалить пункт"
                    aria-label="Удалить пункт"
                    className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => addToList("items")} className="btn btn-secondary mt-2">
              + Добавить пункт
            </button>
          </div>

          <label className="block text-sm">
            <span className="label">Заключительный абзац</span>
            <textarea
              value={about.footer}
              onChange={(e) => setAbout((a) => ({ ...a, footer: e.target.value }))}
              rows={3}
              className="input w-full"
            />
          </label>
        </div>
      </section>

      {/* Карта */}
      <section className={card}>
        <h2 className="mb-4 text-base font-semibold text-slate-800">Карта</h2>
        <label className="block text-sm">
          <span className="label">iframe src</span>
          <input
            type="text"
            value={mapEmbed}
            onChange={(e) => setMapEmbed(e.target.value)}
            placeholder="https://yandex.ru/map-widget/..."
            className="input w-full"
          />
          <span className="mt-1 block text-xs text-slate-500">
            Можно вставить ссылку или целиком код iframe — адрес будет выбран автоматически.
          </span>
        </label>
      </section>

      {/* Время доставки */}
      <section className={card}>
        <h2 className="mb-4 text-base font-semibold text-slate-800">Время доставки</h2>
        <label className="block text-sm">
          <span className="label">Текст</span>
          <input
            type="text"
            value={deliveryTime}
            onChange={(e) => setDeliveryTime(e.target.value)}
            placeholder="Например, 45–60 минут"
            className="input w-full"
          />
        </label>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={pending || uploading !== null}
          className="btn btn-primary disabled:opacity-50"
        >
          {pending ? "Сохранение…" : "Сохранить"}
        </button>
      </div>
      {cropReq && (
        <ImageCropModal
          file={cropReq.file}
          spec={cropReq.spec}
          title={cropReq.title}
          onCancel={() => setCropReq(null)}
          onDone={(cropped) => {
            const done = cropReq.done;
            setCropReq(null);
            done(cropped);
          }}
        />
      )}
    </div>
  );
}
