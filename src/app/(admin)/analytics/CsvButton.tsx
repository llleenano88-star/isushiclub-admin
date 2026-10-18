"use client";

export function CsvButton({ csv, filename }: { csv: string; filename: string }) {
  function download() {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <button type="button" onClick={download} className="btn btn-secondary">
      Экспорт CSV
    </button>
  );
}
