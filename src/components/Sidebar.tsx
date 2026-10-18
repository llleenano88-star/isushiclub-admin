"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/dashboard", icon: "📊", label: "Дашборд", ready: true },
  { href: "/orders", icon: "📦", label: "Заказы", ready: true },
  { href: "/products", icon: "🍣", label: "Товары", ready: true },
  { href: "/categories", icon: "📂", label: "Категории", ready: true },
  { href: "/promo", icon: "🎟", label: "Промокоды", ready: true },
  { href: "/extras", icon: "➕", label: "Доп. товары", ready: true },
  { href: "/delivery", icon: "🚚", label: "Доставка", ready: true },
  { href: "/design", icon: "🎨", label: "Оформление сайта", ready: true },
  { href: "/contacts", icon: "📞", label: "Контакты", ready: true },
  { href: "/analytics", icon: "📈", label: "Аналитика", ready: true },
  { href: "/settings", icon: "⚙️", label: "Настройки", ready: true },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="fixed bottom-0 left-0 top-14 w-60 overflow-y-auto bg-slate-900 py-3">
      <nav className="flex flex-col">
        {ITEMS.map((i) =>
          i.ready ? (
            <Link
              key={i.href}
              href={i.href}
              className={`flex items-center gap-3 border-l-4 px-4 py-2.5 text-sm ${
                path.startsWith(i.href)
                  ? "border-emerald-500 bg-slate-800 font-medium text-white"
                  : "border-transparent text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span className="w-5 text-center">{i.icon}</span>
              {i.label}
            </Link>
          ) : (
            <div key={i.href} className="flex cursor-not-allowed items-center gap-3 border-l-4 border-transparent px-4 py-2.5 text-sm text-slate-500">
              <span className="w-5 text-center opacity-60">{i.icon}</span>
              {i.label}
              <span className="ml-auto text-[10px] text-slate-600">скоро</span>
            </div>
          )
        )}
      </nav>
    </aside>
  );
}
