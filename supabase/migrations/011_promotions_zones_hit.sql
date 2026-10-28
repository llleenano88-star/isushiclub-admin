-- 011: акции, зоны доставки, значок «Хит». Ничего не удаляет, можно запускать повторно.

-- Значок «Хит» у товара
alter table products add column if not exists is_hit boolean not null default false;

-- Акции (подарок от суммы, самый дешёвый в подарок, комбо-подарок, скидка), с временем и днями недели
create table if not exists promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text,
  kind text not null check (kind in ('gift_from_amount','cheapest_free','combo_gift','percent','fixed','bundle_price')),
  config jsonb not null default '{}'::jsonb,
  time_from text,            -- 'HH:MM', пусто = весь день
  time_to text,              -- 'HH:MM'
  weekdays integer[],        -- 1=пн … 7=вс, пусто = каждый день
  starts_at date,            -- необязательно: с какой даты
  ends_at date,              -- необязательно: по какую дату включительно
  receive_type text not null default 'any' check (receive_type in ('any','delivery','pickup')),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table promotions enable row level security;
drop policy if exists "promotions_public_read" on promotions;
create policy "promotions_public_read" on promotions for select using (is_active);

-- Зоны доставки: многоугольник на карте + свои цена, минимальный заказ и порог бесплатной доставки
create table if not exists delivery_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#d81b7a',
  polygon jsonb not null default '[]'::jsonb,   -- [[широта, долгота], ...]
  delivery_price numeric,      -- пусто = как в общих настройках
  min_order numeric,
  free_from numeric,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table delivery_zones enable row level security;
drop policy if exists "delivery_zones_public_read" on delivery_zones;
create policy "delivery_zones_public_read" on delivery_zones for select using (is_active);

-- Заказ: время, зона и применённые акции (для админки)
alter table orders add column if not exists desired_time timestamptz;
alter table orders add column if not exists delivery_zone text;
alter table orders add column if not exists promo_info jsonb;
