-- Abwesenheiten & Schichtplanung
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

create or replace function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create temp table ctx as select
  (select id from public.memberships where email = 'marvin@zeitgeist.demo') as marvin,
  (select id from public.memberships where email = 'lena@zeitgeist.demo') as lena,
  (select id from public.memberships where email = 'sara@zeitgeist.demo') as sara,
  (select id from public.organizations limit 1) as org,
  (now() at time zone 'Europe/Berlin')::date + 40 as d,
  (select id from public.shift_claims limit 1) as claim,
  (select id from public.shift_swap_requests limit 1) as swap;
grant select on ctx to authenticated;

-- ---------------------------------------------------------- Abwesenheiten
select pg_temp.login('marvin@zeitgeist.demo');
select is(
  (select status::text from public.request_absence((select marvin from ctx), 'vacation', (select d from ctx), (select d from ctx) + 4)),
  'pending', 'Urlaub muss genehmigt werden');
select throws_ok(
  $$ select public.request_absence((select marvin from ctx), 'vacation', (select d from ctx) + 2, (select d from ctx) + 6) $$,
  'P0001', 'In diesem Zeitraum ist bereits eine Abwesenheit eingetragen.', 'Überschneidungen werden verhindert');
select is(
  (select status::text from public.request_absence((select marvin from ctx), 'sick', (now() at time zone 'Europe/Berlin')::date - 1, (now() at time zone 'Europe/Berlin')::date)),
  'approved', 'Krankmeldung gilt sofort');
select throws_ok(
  $$ select public.request_absence((select lena from ctx), 'vacation', (select d from ctx), (select d from ctx)) $$,
  '42501', null, 'Niemand beantragt für andere');
select throws_ok(
  $$ select public.request_absence((select marvin from ctx), 'vacation', current_date - 10, current_date - 8) $$,
  'P0001', null, 'Kein rückwirkender Urlaub');
select lives_ok(
  $$ select public.cancel_absence((select id from public.absences where membership_id = (select marvin from ctx) and status = 'pending')) $$,
  'Offenen Antrag zurückziehen');
select is((select count(*)::int from public.list_colleagues((select org from ctx))), 13, 'Kolleg:innen-Liste (nur Name/Standort/Team)');
reset role;

-- ---------------------------------------------------------- Schichtbörse & Tausch
select pg_temp.login('marvin@zeitgeist.demo');
select throws_ok($$ select public.review_shift_claim((select claim from ctx), true) $$, '42501', null, 'Mitarbeitende geben keine Schichten frei');
select throws_ok($$ select public.publish_shifts((select org from ctx), current_date, current_date + 14) $$, '42501', null, 'Mitarbeitende veröffentlichen keine Pläne');
select is((select count(*)::int from public.shifts where status = 'draft'), 0, 'Mitarbeitende sehen keine Schicht-Entwürfe');
reset role;

select pg_temp.login('teamlead@zeitgeist.demo');
select lives_ok($$ select public.review_shift_claim((select claim from ctx), true) $$, 'Teamleiter vergibt offene Schicht an Lena');
select is(
  (select membership_id from public.shifts where id = (select shift_id from public.shift_claims where id = (select claim from ctx))),
  (select lena from ctx), 'Schicht gehört jetzt Lena');
select throws_ok($$ select public.review_shift_swap((select swap from ctx), true) $$, '42501', null, 'Teamleiter Service darf Lager-Tausch nicht freigeben');
select ok((select public.publish_shifts((select org from ctx), current_date, current_date + 14)) >= 1, 'Teamleiter veröffentlicht Entwürfe seines Teams');
reset role;

select pg_temp.login('admin@zeitgeist.demo');
select lives_ok($$ select public.review_shift_swap((select swap from ctx), true) $$, 'Admin genehmigt Tausch (nach Zustimmung von Sara)');
reset role;

select * from finish();
rollback;
