-- Tests für public.stamp() und die Tageswert-Berechnung
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- Unabhängig vom aktuellen Datenstand: Marvin ist zu Beginn ausgecheckt (wird am Ende zurückgerollt)
insert into public.time_events (id, org_id, membership_id, kind, occurred_at, work_date, source)
select gen_random_uuid(), m.org_id, m.id, 'check_out', now() - interval '1 minute',
       (select work_date from public.time_events where membership_id = m.id and voided_at is null order by occurred_at desc limit 1), 'admin'
  from public.memberships m
 where m.email = 'marvin@zeitgeist.demo' and public.member_stamp_state(m.id) <> 'out';

create or replace function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

-- Marvins Mitgliedschaft merken (als Superuser)
create temp table ctx as
  select m.id as mid, (select id from public.memberships where email = 'lena@zeitgeist.demo') as other
    from public.memberships m where m.email = 'marvin@zeitgeist.demo';
grant select on ctx to authenticated;

select pg_temp.login('marvin@zeitgeist.demo');

select throws_ok(
  $$ select public.stamp((select mid from ctx), gen_random_uuid(), 'break_start') $$,
  'P0001', 'Du bist nicht eingecheckt.', 'Pause ohne Check-in wird abgelehnt');

select lives_ok(
  $$ select public.stamp((select mid from ctx), '11111111-1111-4111-8111-111111111111', 'check_in') $$,
  'Check-in klappt');

select is(
  (select count(*)::int from public.time_events where id = '11111111-1111-4111-8111-111111111111'), 1,
  'Buchung ist gespeichert');

select lives_ok(
  $$ select public.stamp((select mid from ctx), '11111111-1111-4111-8111-111111111111', 'check_in') $$,
  'Gleiche Buchungs-ID erneut senden ist idempotent');

select is(
  (select count(*)::int from public.time_events where id = '11111111-1111-4111-8111-111111111111'), 1,
  '… und erzeugt keine Dublette');

select throws_ok(
  $$ select public.stamp((select mid from ctx), gen_random_uuid(), 'check_in') $$,
  'P0001', 'Du bist bereits eingecheckt.', 'Doppeltes Einchecken wird abgelehnt');

select throws_ok(
  $$ select public.stamp((select other from ctx), gen_random_uuid(), 'check_in') $$,
  '42501', null, 'Für Kollegen stempeln ist verboten');

select is(
  (select source::text from public.stamp((select mid from ctx), gen_random_uuid(), 'break_start')),
  'app', 'Pause starten');

select is(
  (select status from public.work_days where membership_id = (select mid from ctx)
     and work_date = (now() at time zone 'Europe/Berlin')::date),
  'open', 'Tageswert ist „offen" während der Arbeit');

select lives_ok(
  $$ select public.stamp((select mid from ctx), gen_random_uuid(), 'check_out') $$,
  'Auschecken aus der Pause heraus ist erlaubt');

select is(
  (select status from public.work_days where membership_id = (select mid from ctx)
     and work_date = (now() at time zone 'Europe/Berlin')::date),
  'complete', 'Tag ist nach dem Auschecken abgeschlossen');

-- Offline: Gerätezeit wird übernommen, aber nur in Grenzen
select throws_ok(
  $$ select public.stamp((select mid from ctx), gen_random_uuid(), 'check_in', 'app', true, now() + interval '1 hour') $$,
  'P0001', 'Buchung liegt in der Zukunft.', 'Offline-Buchung in der Zukunft wird abgelehnt');

select throws_ok(
  $$ select public.stamp((select mid from ctx), gen_random_uuid(), 'check_in', 'app', true, now() - interval '5 days') $$,
  'P0001', null, 'Offline-Buchung älter als 72 h wird abgelehnt');

-- Online wird eine mitgeschickte Gerätezeit ignoriert (Serverzeit gilt)
select ok(
  (select occurred_at > now() - interval '1 minute'
     from public.stamp((select mid from ctx), gen_random_uuid(), 'check_in', 'app', false, now() - interval '3 hours')),
  'Online zählt immer die Serverzeit – Zurückdatieren ist nicht möglich');

select * from finish();
rollback;
