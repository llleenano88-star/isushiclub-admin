"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

export type CategoryInput = {
  name: string;
  slug: string;
  sort_order?: number;
  is_visible: boolean;
};

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validate(input: CategoryInput): string | null {
  if (!input.name.trim()) return "Укажите название категории";
  if (!input.slug.trim()) return "Укажите slug";
  if (!SLUG_RE.test(input.slug.trim())) {
    return "Slug: только латинские буквы, цифры и дефисы (например, rolls-hot)";
  }
  if (input.sort_order !== undefined && !Number.isFinite(input.sort_order)) {
    return "Порядок должен быть числом";
  }
  return null;
}

function dbMessage(e: { code?: string; message: string }): string {
  if (e.code === "23505") return "Категория с таким slug уже существует";
  return e.message;
}

export async function createCategory(input: CategoryInput) {
  await requireAdmin();
  const err = validate(input);
  if (err) return { ok: false as const, error: err };

  const db = createServiceClient();
  let sortOrder = input.sort_order;
  if (sortOrder === undefined) {
    const { data: last } = await db
      .from("categories")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1);
    sortOrder = ((last?.[0]?.sort_order as number | undefined) ?? 0) + 1;
  }

  const { error } = await db.from("categories").insert({
    name: input.name.trim(),
    slug: input.slug.trim(),
    sort_order: sortOrder,
    is_visible: input.is_visible,
  });
  if (error) return { ok: false as const, error: dbMessage(error) };

  revalidatePath("/categories");
  return { ok: true as const };
}

export async function updateCategory(id: string | number, input: CategoryInput) {
  await requireAdmin();
  const err = validate(input);
  if (err) return { ok: false as const, error: err };

  const patch: Record<string, any> = {
    name: input.name.trim(),
    slug: input.slug.trim(),
    is_visible: input.is_visible,
  };
  if (input.sort_order !== undefined) patch.sort_order = input.sort_order;

  const { error } = await createServiceClient().from("categories").update(patch).eq("id", id);
  if (error) return { ok: false as const, error: dbMessage(error) };

  revalidatePath("/categories");
  return { ok: true as const };
}

// Товары не удаляются: у них category_id сбрасывается в null
export async function deleteCategory(id: string | number) {
  await requireAdmin();
  const db = createServiceClient();

  const { error: unlinkError } = await db
    .from("products")
    .update({ category_id: null })
    .eq("category_id", id);
  if (unlinkError) return { ok: false as const, error: unlinkError.message };

  const { error } = await db.from("categories").delete().eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/categories");
  revalidatePath("/products");
  return { ok: true as const };
}

// Принимает id в новом порядке, проставляет sort_order = 1, 2, 3 …
export async function reorderCategories(ids: (string | number)[]) {
  await requireAdmin();
  const db = createServiceClient();

  const results = await Promise.all(
    ids.map((id, index) => db.from("categories").update({ sort_order: index + 1 }).eq("id", id))
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false as const, error: failed.error.message };

  revalidatePath("/categories");
  return { ok: true as const };
}
