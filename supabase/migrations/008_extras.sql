-- Доп. товары (имбирь, васаби, палочки, соус)
create table if not exists extras (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric not null default 0,
  image_url text,
  iiko_id text,
  is_default boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Необязательно: если сайт читает extras через anon-ключ и в проекте включён RLS,
-- раскомментируйте, чтобы сайт видел только активные позиции.
alter table extras enable row level security;
create policy "extras_public_read" on extras for select using (is_active);