-- 012: акционные позиции и новый тип акции «набор за фиксированную цену». Ничего не удаляет, можно запускать повторно.

-- Акционная позиция: отдельный товар со своим кодом iiko и акционной ценой.
-- Если в корзине есть такая позиция, другие акции и промокод не действуют.
alter table products add column if not exists is_promo boolean not null default false;

-- Разрешаем в таблице акций новый тип bundle_price (например, «3 пиццы за 699 ₽»).
-- Требуется, чтобы миграция 011 уже была выполнена.
do $$
begin
  if to_regclass('public.promotions') is not null then
    alter table promotions drop constraint if exists promotions_kind_check;
    alter table promotions add constraint promotions_kind_check
      check (kind in ('gift_from_amount','cheapest_free','combo_gift','percent','fixed','bundle_price'));
  end if;
end $$;
