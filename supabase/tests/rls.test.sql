-- RLS- und Integritätstests. Ausführen mit: pnpm db:test
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

create or replace function pg_temp.login(p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

-- ---------------------------------------------------------------- Mitarbeiter
select pg_temp.login('marvin@zeitgeist.demo');
select is((select count(*) from public.memberships)::int, 1, 'Mitarbeiter sieht nur sich selbst');
select is((select count(distinct membership_id) from public.time_events)::int, 1, 'Mitarbeiter sieht nur eigene Buchungen');
select is((select count(*) from public.audit_log)::int, 0, 'Mitarbeiter sieht kein Audit-Log');
select is((select count(*) from public.compensations)::int, 1, 'Mitarbeiter sieht eigene Vergütung');
select throws_ok($$ select * from public.member_credentials $$, '42501', null, 'Stempel-Geheimnisse sind gesperrt');
select throws_ok(
  $$ insert into public.time_events (id, org_id, membership_id, kind, occurred_at, work_date, source)
     select gen_random_uuid(), org_id, id, 'check_in', now(), current_date, 'app' from public.memberships limit 1 $$,
  '42501', null, 'Direktes Einfügen von Buchungen ist verboten');
select is_empty(
  $$ update public.memberships set role = 'admin' returning id $$,
  'Mitarbeiter kann sich nicht selbst befördern (RLS filtert das Update)');
select is((select count(*) from public.memberships where role = 'admin')::int, 0, '… und die Rolle bleibt unverändert');
reset role;

-- ---------------------------------------------------------------- Teamleiter
select pg_temp.login('teamlead@zeitgeist.demo');
select is((select count(*) from public.memberships)::int, 6, 'Teamleiter sieht sich + 5 Teammitglieder');
select is((select count(*) from public.compensations)::int, 1, 'Teamleiter sieht keine fremden Löhne');
select is((select count(*) from public.documents)::int, 0, 'Teamleiter sieht keine Personalakten');
reset role;

-- ---------------------------------------------------------------- Admin
select pg_temp.login('admin@zeitgeist.demo');
select is((select count(*) from public.memberships)::int, 13, 'Admin sieht alle Mitglieder');
select ok((select count(*) from public.audit_log) > 0, 'Admin sieht das Audit-Log');
select is(public.verify_audit_chain('00000000-0000-4000-8000-000000000001'), null, 'Hash-Kette ist intakt');
reset role;

-- ---------------------------------------------------------------- Unveränderlichkeit (auch als Superuser)
select throws_ok($$ delete from public.time_events where true $$, 'P0001', null, 'Buchungen sind nicht löschbar');
select throws_ok($$ update public.audit_log set reason = 'x' where true $$, 'P0001', null, 'Audit-Log ist unveränderlich');

select * from finish();
rollback;
