"use client";

import { useEffect, useState } from "react";
import Cropper from "react-easy-crop";
import { cropToWebp, type Area, type CropSpec } from "@/lib/imageCrop";

export function ImageCropModal({
  file,
  spec,
  title = "Обрезка фото",
  onCancel,
  onDone,
}: {
  file: File;
  spec: CropSpec;
  title?: string;
  onCancel: () => void;
  onDone: (cropped: File) => void;
}) {
  const [src, setSrc] = useState("");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function save() {
    if (!area) return;
    setBusy(true);
    setError(null);
    try {
      const cropped = await cropToWebp(src, area, spec, file.name);
      onDone(cropped);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось обработать фото");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-800">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Перетаскивайте фото и меняйте масштаб ползунком. Итоговый размер: {spec.width}×{spec.height}.
          </p>
        </div>
        <div className="px-5 py-4">
          {error && (
            <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          <div className="relative h-80 w-full overflow-hidden rounded-md bg-slate-900">
            {src && (
              <Cropper
                image={src}
                crop={crop}
                zoom={zoom}
                aspect={spec.aspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, pixels) => setArea(pixels)}
              />
            )}
          </div>
          <label className="mt-4 flex items-center gap-3 text-sm text-slate-700">
            <span className="w-16">Масштаб</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1"
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button type="button" onClick={onCancel} disabled={busy} className="btn btn-secondary">
            Отмена
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy || !area}
            className="btn btn-primary disabled:opacity-50"
          >
            {busy ? "Обработка…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
