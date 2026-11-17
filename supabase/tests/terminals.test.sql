-- Terminal-Stempeln & Erfassungswege
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- Unabhängig vom aktuellen Datenstand: Marvin ist zu Beginn ausgecheckt (wird am Ende zurückgerollt)
insert into public.time_events (id, org_id, membership_id, kind, occurred_at, work_date, source)
select gen_random_uuid(), m.org_id, m.id, 'check_out',
       greatest(now() - interval '1 minute',
                (select occurred_at + interval '1 second' from public.time_events where membership_id = m.id and voided_at is null order by occurred_at desc limit 1)),
       (select work_date from public.time_events where membership_id = m.id and voided_at is null order by occurred_at desc limit 1), 'admin'
  from public.memberships m
 where m.email = 'marvin@zeitgeist.demo' and public.member_stamp_state(m.id) <> 'out';

create or replace function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create temp table ctx as select
  (select id from public.memberships where email = 'marvin@zeitgeist.demo') as marvin,
  '00000000-0000-4000-8000-0000000000a1'::uuid as terminal;
grant select on ctx to authenticated, service_role;

-- Mitarbeiter dürfen terminal_stamp nicht direkt aufrufen
select pg_temp.login('marvin@zeitgeist.demo');
select throws_ok(
  $$ select public.terminal_stamp((select terminal from ctx), (select marvin from ctx), gen_random_uuid(), 'pin') $$,
  '42501', null, 'terminal_stamp ist für Nutzer gesperrt');
select throws_ok(
  $$ select public.stamp((select marvin from ctx), gen_random_uuid(), 'check_in', 'terminal_qr') $$,
  '42501', null, 'Über die App lässt sich kein Terminal-Weg vortäuschen');
select is(
  (select geo_lat from public.stamp((select marvin from ctx), gen_random_uuid(), 'check_in', 'app', false, null, null, 50.9, 6.9, 10)),
  null::double precision, 'Ohne Einwilligung wird kein Standort gespeichert (DSGVO)');
reset role;

-- service_role (Server) stempelt automatisch: aus → Pause? nein: eingecheckt → Gehen
set local role service_role;
select is(
  (select kind::text from public.terminal_stamp((select terminal from ctx), (select marvin from ctx), gen_random_uuid(), 'pin')),
  'check_out', 'Automatisch: wer eingecheckt ist, wird ausgecheckt');
select is(
  (select kind::text from public.terminal_stamp((select terminal from ctx), (select marvin from ctx), gen_random_uuid(), 'rfid')),
  'check_in', 'Automatisch: wer ausgecheckt ist, wird eingecheckt');
select is(
  (select terminal_id from public.time_events where membership_id = (select marvin from ctx) and source = 'rfid'),
  (select terminal from ctx), 'Buchung kennt ihr Terminal');
select throws_ok(
  $$ select public.terminal_stamp((select terminal from ctx), (select marvin from ctx), gen_random_uuid(), 'app') $$,
  'P0001', null, 'Terminal darf keine App-Buchungen erzeugen');
reset role;

update public.terminals set revoked_at = now() where id = (select terminal from ctx);
set local role service_role;
select throws_ok(
  $$ select public.terminal_stamp((select terminal from ctx), (select marvin from ctx), gen_random_uuid(), 'pin') $$,
  '42501', null, 'Entkoppelte Terminals können nicht mehr stempeln');
reset role;

select * from finish();
rollback;
