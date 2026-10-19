// Обрезка и сжатие фото в браузере: canvas -> WebP (запасной вариант JPEG)

export const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_SOURCE_BYTES = 10 * 1024 * 1024; // исходный файл — до 10 МБ
export const MAX_OUT_BYTES = 500 * 1024; // итог сжимается до 500 КБ

export type Area = { x: number; y: number; width: number; height: number };
export type CropSpec = { aspect: number; width: number; height: number };

export const SPECS = {
  product: { aspect: 1, width: 500, height: 500 } as CropSpec,
  banner: { aspect: 3, width: 1800, height: 600 } as CropSpec,
  cover: { aspect: 3, width: 1200, height: 400 } as CropSpec,
};

export function validateSource(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return "Допустимые форматы: JPEG, PNG, WebP";
  }
  if (file.size > MAX_SOURCE_BYTES) {
    return "Файл слишком большой. Загрузите до 10 МБ";
  }
  return null;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Не удалось открыть изображение"));
    img.src = src;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

// Кодирует с качеством 0.85 и, если файл больше 500 КБ, понижает качество
async function encode(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  let last: Blob | null = null;
  for (const q of [0.85, 0.75, 0.65, 0.55, 0.45, 0.35]) {
    const b = await toBlob(canvas, type, q);
    if (!b || b.type !== type) return null; // браузер не умеет этот формат
    last = b;
    if (b.size <= MAX_OUT_BYTES) break;
  }
  return last;
}

export async function cropToWebp(
  src: string,
  area: Area,
  spec: CropSpec,
  baseName: string
): Promise<File> {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = spec.width;
  canvas.height = spec.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Браузер не поддерживает обработку изображений");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, spec.width, spec.height);

  const blob = (await encode(canvas, "image/webp")) ?? (await encode(canvas, "image/jpeg"));
  if (!blob) throw new Error("Не удалось сжать изображение");

  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  const name = baseName.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "") || "photo";
  return new File([blob], `${name}.${ext}`, { type: blob.type });
}
