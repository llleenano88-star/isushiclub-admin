-- 010: перчик «острый», соус для любой лапши, выбор ролла в «запечённой классике».
-- Ничего не удаляет. Выбор ставится только там, где он ещё не задан. Можно запускать повторно.
alter table products add column if not exists options jsonb not null default '[]'::jsonb;
alter table products add column if not exists is_spicy boolean not null default false;

-- 1) Любая лапша (удон, лапша, рамен, соба, вок): выбор соуса «острый / не острый»
update products p
set options = '[{"title":"Соус","choices":["Острый","Не острый"]}]'::jsonb
where (p.options is null or p.options = '[]'::jsonb)
  and (
    p.name ~* '(удон|лапш|рамен|соба|\mвок\M)'
    or exists (select 1 from categories c where c.id = p.category_id and c.name ~* '(удон|лапш|рамен|соба|\mвок\M)')
  );

-- 2) «Запечённая классика»: выбор ролла из роллов категории «Классические» (названия берутся из вашей базы)
update products p
set options = jsonb_build_array(jsonb_build_object(
  'title', 'Ролл',
  'choices', (
    select coalesce(jsonb_agg(r.name order by r.name), '[]'::jsonb)
    from products r
    join categories c on c.id = r.category_id
    where c.name ~* 'классическ' and c.name !~* 'запеч' and r.is_available and r.id <> p.id
  )
))
where p.name ~* 'запеч.*классик'
  and (p.options is null or p.options = '[]'::jsonb)
  and exists (
    select 1 from products r join categories c on c.id = r.category_id
    where c.name ~* 'классическ' and c.name !~* 'запеч' and r.is_available
  );

-- 3) Перчик на карточке: ставим «острый» там, где в названии или описании есть «остр», «спайси», «чили» и т.п.
-- (кроме «не острый»). Лишнее можно снять галочкой в админке: Товары → товар → «Острый».
update products
set is_spicy = true
where not is_spicy
  and (lower(name || ' ' || coalesce(description, '')) ~ '(остр|спайс|spicy|чили|chili|халапен|табаско|шрирача)')
  and (lower(name || ' ' || coalesce(description, '')) !~ 'не\s*остр');
