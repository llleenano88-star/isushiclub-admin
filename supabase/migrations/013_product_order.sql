-- 013: порядок блюд в меню (задаётся в админке, раздел «Порядок блюд»). Ничего не удаляет, можно запускать повторно.
alter table products add column if not exists sort_order integer not null default 1000;

-- Сохраняем текущий порядок: нумеруем блюда внутри каждой категории (10, 20, 30…).
-- Новые блюда из iiko получают 1000 и встают в конец категории. Делается только там, где порядок ещё не задан.
update products p
set sort_order = r.rn * 10
from (
  select id, row_number() over (partition by category_id order by created_at, name) as rn
  from products
) r
where p.id = r.id and p.sort_order = 1000;
