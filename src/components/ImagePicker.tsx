"use client";

import { useState } from "react";
import { ImageCropModal } from "@/components/ImageCropModal";
import { validateSource, ALLOWED_TYPES, type CropSpec } from "@/lib/imageCrop";

// Готовый блок «фото»: превью + выбор файла + редактор обрезки.
// onChange(result): result = { file, preview } после обрезки или null, если фото убрали.
// Если файл не выбран — компонент ничего не меняет.
export function ImagePicker({
  preview,
  spec,
  onChange,
  onError,
  title,
  allowRemove = true,
}: {
  preview: string | null;
  spec: CropSpec;
  onChange: (result: { file: File; preview: string } | null) => void;
  onError: (message: string) => void;
  title?: string;
  allowRemove?: boolean;
}) {
  const [pending, setPending] = useState<File | null>(null);

  function onPick(file: File | null) {
    if (!file) return;
    const err = validateSource(file);
    if (err) {
      onError(err);
      return;
    }
    setPending(file);
  }

  return (
    <div className="flex items-center gap-3">
      <div
        className="overflow-hidden rounded-md border border-slate-200 bg-slate-100"
        style={{ aspectRatio: String(spec.aspect), height: 64 }}
      >
        {preview && <img src={preview} alt="" className="h-full w-full object-cover" />}
      </div>
      <label className="btn btn-secondary cursor-pointer">
        {preview ? "Заменить фото" : "Загрузить фото"}
        <input
          type="file"
          accept={ALLOWED_TYPES.join(",")}
          className="hidden"
          onChange={(e) => {
            onPick(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
      </label>
      {preview && allowRemove && (
        <button type="button" onClick={() => onChange(null)} className="btn btn-secondary">
          Убрать
        </button>
      )}
      {pending && (
        <ImageCropModal
          file={pending}
          spec={spec}
          title={title}
          onCancel={() => setPending(null)}
          onDone={(cropped) => {
            setPending(null);
            onChange({ file: cropped, preview: URL.createObjectURL(cropped) });
          }}
        />
      )}
    </div>
  );
}
