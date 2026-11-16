-- Tests für Verwaltungsfunktionen: Korrekturen, Freigaben, gesperrte Monate
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

create or replace function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create temp table ctx as
  select
    (select id from public.memberships where email = 'marvin@zeitgeist.demo') as marvin,
    (select id from public.memberships where email = 'sara@zeitgeist.demo') as sara,
    (select max(work_date) from public.time_events e join public.memberships m on m.id = e.membership_id
      where m.email = 'marvin@zeitgeist.demo' and work_date < (now() at time zone 'Europe/Berlin')::date) as marvin_day,
    (select id from public.correction_requests limit 1) as lukas_request,
    (select id from public.absences where status = 'pending' limit 1) as sara_absence,
    date_trunc('month', now() - interval '1 month')::date as locked_month;
grant select on ctx to authenticated;

-- ------------------------------------------------------------ Teamleiter
select pg_temp.login('teamlead@zeitgeist.demo');

select throws_ok(
  $$ select public.admin_correct_day((select marvin from ctx), (select marvin_day from ctx), '{}', '[]', '') $$,
  'P0001', null, 'Ohne Begründung keine Korrektur');

select lives_ok(
  $$ select public.admin_correct_day(
       (select marvin from ctx), (select marvin_day from ctx),
       array[(select id from public.time_events where membership_id = (select marvin from ctx)
                and work_date = (select marvin_day from ctx) and kind = 'check_out' and voided_at is null)],
       jsonb_build_array(jsonb_build_object('kind', 'check_out',
         'occurred_at', ((select marvin_day from ctx) + time '17:30') at time zone 'Europe/Berlin')),
       'Hat vergessen auszustempeln') $$,
  'Teamleiter korrigiert Zeit im eigenen Team');

select is(
  (select count(*)::int from public.time_events where membership_id = (select marvin from ctx)
     and work_date = (select marvin_day from ctx) and voided_at is not null), 1,
  'Alte Buchung ist ungültig markiert – nicht gelöscht');

select is(
  (select to_char(last_out at time zone 'Europe/Berlin', 'HH24:MI') from public.work_days
    where membership_id = (select marvin from ctx) and work_date = (select marvin_day from ctx)),
  '17:30', 'Tageswert ist neu berechnet');

select throws_ok(
  $$ select public.admin_correct_day((select sara from ctx), current_date, '{}', '[]', 'Test') $$,
  '42501', null, 'Teamleiter kann fremdes Team nicht korrigieren');

select throws_ok(
  $$ select public.review_correction((select lukas_request from ctx), true) $$,
  '42501', null, 'Teamleiter kann Anträge fremder Teams nicht freigeben');

select throws_ok(
  $$ select public.admin_correct_day((select marvin from ctx), (select locked_month from ctx) + 3, '{}', '[]', 'Nachtrag') $$,
  '42501', null, 'Gesperrter Monat: Teamleiter darf nicht mehr korrigieren');
reset role;

-- Audit-Log enthält Begründung (als Superuser geprüft)
select ok(
  exists (select 1 from public.audit_log where entity = 'time_events' and action = 'void' and reason = 'Hat vergessen auszustempeln'),
  'Audit-Log protokolliert das Ungültig-Markieren mit Begründung');

-- ------------------------------------------------------------ Admin
select pg_temp.login('admin@zeitgeist.demo');

select lives_ok(
  $$ select public.review_correction((select lukas_request from ctx), true, 'Passt') $$,
  'Admin genehmigt Korrekturantrag');
select is((select status::text from public.correction_requests where id = (select lukas_request from ctx)), 'approved', 'Status ist genehmigt');
select throws_ok(
  $$ select public.review_correction((select lukas_request from ctx), true) $$,
  'P0001', 'Dieser Antrag wurde bereits bearbeitet.', 'Doppelte Freigabe wird verhindert');

select lives_ok(
  $$ select public.admin_correct_day((select marvin from ctx), (select locked_month from ctx) + 3, '{}', '[]', 'Nachtrag nach Abschluss') $$,
  'Admin darf im gesperrten Monat mit Begründung korrigieren');

select lives_ok($$ select public.review_absence((select sara_absence from ctx), true) $$, 'Admin genehmigt Urlaub');
reset role;

select is(
  (select count(*)::int from public.notifications n join public.memberships m on m.user_id = n.user_id
    where m.email in ('lukas@zeitgeist.demo', 'sara@zeitgeist.demo')), 2,
  'Beide Antragsteller wurden benachrichtigt');

-- ------------------------------------------------------------ Mitarbeiter
select pg_temp.login('marvin@zeitgeist.demo');
select throws_ok(
  $$ select public.admin_correct_day((select marvin from ctx), current_date, '{}', '[]', 'Selbst ist der Mann') $$,
  '42501', null, 'Mitarbeiter können ihre Zeiten nicht direkt ändern');
reset role;

select * from finish();
rollback;
