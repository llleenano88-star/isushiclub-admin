# iSushiClub — админ-панель

Отдельный проект на Next.js 15 + Tailwind + Supabase. Работает на поддомене `admin.isushiclub.ru`.

## Этап 1 (в этой версии)
Вход (email + пароль), middleware с проверкой `role = 'admin'`, боковое меню, **Заказы**, **Товары**.
Остальные разделы в меню помечены «скоро».

## Запуск
```bash
cp .env.example .env.local   # заполните ключи Supabase
npm install
npm run dev                  # http://localhost:3000
npm run build
```

## Первый админ
См. `supabase/create-first-admin.sql`.

## Деплой
1. Репозиторий на GitHub → импорт в Vercel как **новый** проект.
2. Environment Variables — те же, что у сайта (см. `.env.example`).
3. Vercel → Settings → Domains → добавить `admin.isushiclub.ru`.
4. Cloudflare → DNS: `CNAME admin → cname.vercel-dns.com`, режим **DNS only** (серое облако).

## Безопасность
- `SUPABASE_SERVICE_ROLE_KEY` используется только на сервере (middleware, server actions).
- Каждое серверное действие повторно проверяет роль (`requireAdmin`), не полагаясь только на middleware.
