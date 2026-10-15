"use client";
import { createContext, useCallback, useContext, useState } from "react";

type ToastItem = { id: number; text: string; type: "success" | "error" };
const Ctx = createContext<(text: string, type?: "success" | "error") => void>(() => {});

export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((text: string, type: "success" | "error" = "success") => {
    const id = Date.now() + Math.random();
    setItems((l) => [...l, { id, text, type }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 3500);
  }, []);

  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="fixed right-4 top-16 z-[100] flex flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={`min-w-64 rounded-md px-4 py-3 text-sm font-medium text-white shadow-lg ${
              t.type === "success" ? "bg-emerald-600" : "bg-red-600"
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
