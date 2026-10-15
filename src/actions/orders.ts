"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

export async function updateOrderStatus(id: string | number, status: string) {
  await requireAdmin();
  const { error } = await createServiceClient().from("orders").update({ status }).eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/orders");
  return { ok: true as const };
}

export async function getOrderItems(orderId: string | number) {
  await requireAdmin();
  const { data, error } = await createServiceClient().from("order_items").select("*").eq("order_id", orderId);
  if (error) return { ok: false as const, error: error.message, items: [] as any[] };
  return { ok: true as const, items: (data ?? []) as any[] };
}
