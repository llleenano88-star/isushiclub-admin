-- Как создать первого администратора
--
-- 1. Supabase → Authentication → Users → Add user → Create new user.
--    Введите email и пароль, включите «Auto Confirm User».
--
-- 2. Supabase → SQL Editor → выполните (подставьте свой email):

insert into public.profiles (id, role)
select id, 'admin' from auth.users where email = 'ВАШ_EMAIL@example.com'
on conflict (id) do update set role = 'admin';

-- Если в profiles есть обязательные колонки помимо id и role — добавьте их в insert.
-- Проверка:
-- select u.email, p.role from auth.users u join public.profiles p on p.id = u.id;
