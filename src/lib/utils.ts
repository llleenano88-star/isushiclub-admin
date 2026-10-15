export const money = (n: number | string | null | undefined) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(Number(n) || 0) + " ₽";

export const dateTime = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }) : "—";

export function sortBy<T>(rows: T[], get: (r: T) => string | number | null | undefined, dir: "asc" | "desc") {
  const k = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = get(a) ?? "";
    const y = get(b) ?? "";
    if (typeof x === "number" && typeof y === "number") return (x - y) * k;
    return String(x).localeCompare(String(y), "ru") * k;
  });
}

export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  // BOM + «;» — чтобы Excel в русской локали открыл файл корректно
  const csv = "\uFEFF" + rows.map((r) => r.map(esc).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
