"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { uploadImage } from "@/lib/upload";

function readForm(fd: FormData) {
  const sortRaw = String(fd.get("sort_order") ?? "").trim();
  const file = fd.get("image");
  return {
    name: String(fd.get("name") ?? "").trim(),
    price: Number(String(fd.get("price") ?? "0").trim() || "0"),
    iiko_id: String(fd.get("iiko_id") ?? "").trim(),
    is_default: fd.get("is_default") === "1",
    is_active: fd.get("is_active") === "1",
    sort_order: sortRaw === "" ? undefined : Number(sortRaw),
    remove_image: fd.get("remove_image") === "1",
    file: file instanceof File && file.size > 0 ? file : null,
  };
}

function validate(f: ReturnType<typeof readForm>): string | null {
  if (!f.name) return "Укажите название";
  if (!Number.isFinite(f.price) || f.price < 0) return "Цена не может быть отрицательной";
  if (f.sort_order !== undefined && !Number.isFinite(f.sort_order)) return "Порядок должен быть числом";
  return null;
}

export async function createExtra(fd: FormData) {
  await requireAdmin();
  const f = readForm(fd);
  const err = validate(f);
  if (err) return { ok: false as const, error: err };

  const db = createServiceClient();

  let imageUrl: string | null = null;
  if (f.file) {
    const up = await uploadImage(f.file, "extras");
    if (!up.ok) return { ok: false as const, error: up.error };
    imageUrl = up.url;
  }

  let sortOrder = f.sort_order;
  if (sortOrder === undefined) {
    const { data: last } = await db
      .from("extras")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1);
    sortOrder = ((last?.[0]?.sort_order as number | undefined) ?? 0) + 1;
  }

  const { error } = await db.from("extras").insert({
    name: f.name,
    price: f.price,
    image_url: imageUrl,
    iiko_id: f.iiko_id || null,
    is_default: f.is_default,
    is_active: f.is_active,
    sort_order: sortOrder,
  });
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/extras");
  return { ok: true as const };
}

export async function updateExtra(id: string | number, fd: FormData) {
  await requireAdmin();
  const f = readForm(fd);
  const err = validate(f);
  if (err) return { ok: false as const, error: err };

  const patch: Record<string, any> = {
    name: f.name,
    price: f.price,
    iiko_id: f.iiko_id || null,
    is_default: f.is_default,
    is_active: f.is_active,
  };
  if (f.sort_order !== undefined) patch.sort_order = f.sort_order;

  if (f.file) {
    const up = await uploadImage(f.file, "extras");
    if (!up.ok) return { ok: false as const, error: up.error };
    patch.image_url = up.url;
  } else if (f.remove_image) {
    patch.image_url = null;
  }

  const { error } = await createServiceClient().from("extras").update(patch).eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/extras");
  return { ok: true as const };
}

export async function toggleExtra(
  id: string | number,
  field: "is_active" | "is_default",
  value: boolean
) {
  await requireAdmin();
  const { error } = await createServiceClient()
    .from("extras")
    .update({ [field]: value })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/extras");
  return { ok: true as const };
}

export async function deleteExtra(id: string | number) {
  await requireAdmin();
  const { error } = await createServiceClient().from("extras").delete().eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/extras");
  return { ok: true as const };
}
