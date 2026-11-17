-- Tests für Benachrichtigungen und Push-Abos
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

create or replace function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create temp table ctx as
  select (select id from auth.users where email = 'marvin@zeitgeist.demo') as marvin,
         (select id from auth.users where email = 'lena@zeitgeist.demo') as lena;
grant select on ctx to authenticated;
insert into public.notifications (id, user_id, kind, title) values
  ('aaaaaaaa-0000-4000-8000-000000000001', (select marvin from ctx), 'test', 'Für Marvin'),
  ('aaaaaaaa-0000-4000-8000-000000000002', (select lena from ctx), 'test', 'Für Lena');

select pg_temp.login('marvin@zeitgeist.demo');

select is((select count(*)::int from public.notifications where id::text like 'aaaaaaaa-%'), 1, 'Man sieht nur eigene Benachrichtigungen');

select throws_ok(
  $$ update public.notifications set title = 'gefälscht' where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  '42501', null, 'Titel ist unveränderlich');

select throws_ok(
  $$ insert into public.notifications (user_id, kind, title) values ((select lena from ctx), 'x', 'Spam') $$,
  '42501', null, 'Niemand kann anderen Benachrichtigungen schicken');

select ok(public.mark_notifications_read() >= 1, 'Alle eigenen als gelesen markieren');

reset role;
select ok(
  (select read_at is not null from public.notifications where id = 'aaaaaaaa-0000-4000-8000-000000000001')
  and (select read_at is null from public.notifications where id = 'aaaaaaaa-0000-4000-8000-000000000002'),
  '… betrifft nur die eigenen');

select pg_temp.login('marvin@zeitgeist.demo');
select lives_ok(
  $$ select public.save_push_subscription('https://push.example.com/abc', 'p256', 'auth') $$,
  'Push-Abo speichern');
select throws_ok(
  $$ select public.save_push_subscription('http://evil.example.com/abc', 'p256', 'auth') $$,
  'P0001', 'Ungültiges Push-Abo', 'Nur HTTPS-Endpunkte');

-- Gleiches Gerät, anderer Nutzer: Abo wandert mit (kein Push mehr an den vorherigen)
reset role;
select pg_temp.login('lena@zeitgeist.demo');
select lives_ok($$ select public.save_push_subscription('https://push.example.com/abc', 'p256', 'auth') $$, 'Kontowechsel auf demselben Gerät');
reset role;
select is((select user_id from public.push_subscriptions where endpoint = 'https://push.example.com/abc'), (select lena from ctx), 'Abo gehört jetzt der neuen Person');

select * from finish();
rollback;
