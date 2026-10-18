import { createServiceClient } from "@/lib/supabase/server";

// Значение site_settings может прийти числом, объектом или JSON-строкой
export function parseValue(v: unknown): unknown {
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }
  return v;
}

export async function readSettings(
  keys: string[]
): Promise<{ map: Record<string, unknown>; error: string | null }> {
  const { data, error } = await createServiceClient()
    .from("site_settings")
    .select("key, value")
    .in("key", keys);
  const map: Record<string, unknown> = {};
  for (const row of (data ?? []) as any[]) map[row.key] = parseValue(row.value);
  return { map, error: error ? error.message : null };
}

export function asString(v: unknown): string {
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
}
