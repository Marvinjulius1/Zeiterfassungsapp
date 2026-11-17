-- Tests für Monatsabschluss: bestätigen, sperren, entsperren
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

create or replace function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create temp table ctx as
  select (select id from public.memberships where email = 'marvin@zeitgeist.demo') as marvin,
         (select id from public.memberships where email = 'lena@zeitgeist.demo') as lena,
         (select org_id from public.memberships where email = 'marvin@zeitgeist.demo') as org,
         date_trunc('month', (now() at time zone 'Europe/Berlin') - interval '2 months')::date as old_month,
         date_trunc('month', (now() at time zone 'Europe/Berlin'))::date as this_month;
update public.organizations set payroll_settings = '{"beraterNr":"7"}' where id = (select org from ctx);
-- Vorvormonat für beide frei machen (unabhängig vom Seed)
delete from public.month_closings where month = (select old_month from ctx);
grant select on ctx to authenticated;

-- Mitarbeitende ------------------------------------------------------------
reset role;
select pg_temp.login('marvin@zeitgeist.demo');

select throws_ok(
  $$ select public.confirm_month((select marvin from ctx), (select this_month from ctx), '{}') $$,
  'P0001', 'Bestätigen geht erst, wenn der Monat vorbei ist.', 'Laufender Monat kann nicht bestätigt werden');

select lives_ok(
  $$ select public.confirm_month((select marvin from ctx), (select old_month from ctx), '{"valued": 9600}') $$,
  'Abgelaufener Monat kann bestätigt werden');

select isnt(
  (select employee_confirmed_at from public.month_closings where membership_id = (select marvin from ctx) and month = (select old_month from ctx)),
  null, 'Bestätigung ist gespeichert und für die Person sichtbar');

select throws_ok(
  $$ select public.confirm_month((select lena from ctx), (select old_month from ctx), '{}') $$,
  '42501', null, 'Für Kollegen bestätigen ist verboten');

select throws_ok(
  $$ select public.lock_months((select old_month from ctx), jsonb_build_array(jsonb_build_object('membership_id', (select marvin from ctx), 'snapshot', '{}'::jsonb))) $$,
  '42501', null, 'Mitarbeitende können keine Monate sperren');

update public.organizations set payroll_settings = '{"beraterNr":"1"}' where id = (select org from ctx);
reset role;
select is(
  (select payroll_settings from public.organizations where id = (select org from ctx)) ->> 'beraterNr',
  '7', 'Mitarbeitende können die DATEV-Einstellungen nicht ändern');

-- Teamleitung ----------------------------------------------------------------
reset role;
select pg_temp.login('teamlead@zeitgeist.demo');

select throws_ok(
  $$ select public.lock_months((select old_month from ctx), jsonb_build_array(jsonb_build_object('membership_id', (select marvin from ctx), 'snapshot', '{}'::jsonb))) $$,
  '42501', null, 'Teamleitung kann keine Monate sperren');

-- Admin ------------------------------------------------------------------------
reset role;
select pg_temp.login('admin@zeitgeist.demo');

select throws_ok(
  $$ select public.lock_months((select this_month from ctx), jsonb_build_array(jsonb_build_object('membership_id', (select marvin from ctx), 'snapshot', '{}'::jsonb))) $$,
  'P0001', null, 'Laufender Monat kann nicht abgeschlossen werden');

select is(
  public.lock_months((select old_month from ctx), jsonb_build_array(jsonb_build_object('membership_id', (select marvin from ctx), 'snapshot', '{"valued": 9600}'::jsonb))),
  1, 'Admin schließt den Monat ab');

select ok(
  (select locked_at is not null and employee_confirmed_at is not null
     from public.month_closings where membership_id = (select marvin from ctx) and month = (select old_month from ctx)),
  'Sperre ergänzt die Bestätigung, ohne sie zu überschreiben');

-- Gesperrter Monat: Teamleitung darf nicht mehr korrigieren
reset role;
select pg_temp.login('teamlead@zeitgeist.demo');
select throws_ok(
  $$ select public.admin_correct_day((select marvin from ctx), (select old_month from ctx) + 3, '{}', '[]', 'Test-Korrektur') $$,
  '42501', 'Der Monat ist abgeschlossen – nur Admins dürfen noch korrigieren.', 'Gesperrter Monat blockiert Korrekturen der Teamleitung');

reset role;
select pg_temp.login('admin@zeitgeist.demo');
select throws_ok(
  $$ select public.unlock_month((select marvin from ctx), (select old_month from ctx), ' ') $$,
  'P0001', 'Bitte gib eine Begründung an.', 'Entsperren braucht eine Begründung');

select lives_ok(
  $$ select public.unlock_month((select marvin from ctx), (select old_month from ctx), 'Krankmeldung nachgereicht') $$,
  'Admin öffnet den Monat mit Begründung');

select is(
  (select reason from public.audit_log where entity = 'month_closings' order by created_at desc, id desc limit 1),
  'Krankmeldung nachgereicht', 'Begründung steht im Audit-Log');

select * from finish();
rollback;
