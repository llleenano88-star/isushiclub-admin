-- 009: выбор у товара (соус острый / не острый, выбор ролла)
-- Формат: [{"title":"Соус","choices":["Острый","Не острый"]}]. У вариантов выбора своих iiko-кодов нет.
alter table products add column if not exists options jsonb not null default '[]'::jsonb;

-- Удон: сразу ставим выбор соуса всем товарам, у которых «удон» в названии или в названии категории.
-- Только там, где выбор ещё не задан. Ничего не удаляет и не меняет остальные поля.
update products p
set options = '[{"title":"Соус","choices":["Острый","Не острый"]}]'::jsonb
where (p.options is null or p.options = '[]'::jsonb)
  and (
    p.name ilike '%удон%'
    or exists (select 1 from categories c where c.id = p.category_id and c.name ilike '%удон%')
  );

-- «Запечённая классика»: список роллов для выбора задаётся в админке (Товары → товар → «Выбор у товара»).
-- Код доставки для iiko хранится в site_settings (ключ delivery_iiko_id) и задаётся в админке, раздел «Доставка». Миграция для него не нужна.
