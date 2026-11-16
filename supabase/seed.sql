-- =============================================================================
-- Zeitgeist · Demo-Daten (nur lokale Entwicklung!)
--
-- Login lokal: Magic Link (Mails unter http://127.0.0.1:54324) oder im
-- Dev-Modus per „Schnell-Login" mit dem Passwort  zeitgeist-demo
--
--   owner@zeitgeist.demo      Owner        Alex Becker
--   admin@zeitgeist.demo      Admin        Sophie Wagner
--   teamlead@zeitgeist.demo   Teamleiter   Jonas Hoffmann
--   marvin@zeitgeist.demo     Azubi        Marvin Julius     (Berufsschule dienstags)
--   noah@zeitgeist.demo       Azubi (17)   Noah Klein        ← Jugendarbeitsschutz
--   anna@zeitgeist.demo       Mutterschutz Anna Kowalski
--   … insgesamt 10 Mitarbeiter + Owner, Admin, Teamleiter
-- =============================================================================

do $seed$
declare
  v_org   uuid := '00000000-0000-4000-8000-000000000001';
  v_koeln uuid := '00000000-0000-4000-8000-000000000011';
  v_hh    uuid := '00000000-0000-4000-8000-000000000012';
  v_team_service uuid := '00000000-0000-4000-8000-000000000021';
  v_team_lager   uuid := '00000000-0000-4000-8000-000000000022';
  v_pw text := extensions.crypt('zeitgeist-demo', extensions.gen_salt('bf'));
  r record;
  v_uid uuid;
  v_mid uuid;
  d date;
  v_target int;
  v_in timestamptz;
  v_bs timestamptz;
  v_be timestamptz;
  v_out timestamptz;
  v_jitter int;
  v_break int;
  v_today date := (now() at time zone 'Europe/Berlin')::date;
begin
  perform setseed(0.42);

  insert into public.organizations (id, name, slug, default_state, onboarding_completed_at)
  values (v_org, 'Zeitgeist Demo GmbH', 'zeitgeist-demo', 'NW', now());

  insert into public.locations (id, org_id, name, address, state, geofence_lat, geofence_lng, geofence_radius_m) values
    (v_koeln, v_org, 'Köln',    'Hohenzollernring 1, 50672 Köln', 'NW', 50.9375, 6.9403, 150),
    (v_hh,    v_org, 'Hamburg', 'Am Sandtorkai 1, 20457 Hamburg', 'HH', 53.5430, 9.9890, 150);

  insert into public.teams (id, org_id, location_id, name) values
    (v_team_service, v_org, v_koeln, 'Service'),
    (v_team_lager,   v_org, v_hh,    'Lager & Logistik');

  insert into public.projects (org_id, name, cost_center) values
    (v_org, 'Tagesgeschäft', '4000'),
    (v_org, 'Inventur 2026', '4100'),
    (v_org, 'Messe Köln',    '4200');

  -- ---------------------------------------------------------------------------
  -- Personen: email, Name, Rolle, Standort, Team, Vertrag, Wochenmin., Tagesziele, Urlaub, Geburtstag, Mutterschutz, Stundenlohn
  -- ---------------------------------------------------------------------------
  for r in
    select * from (values
      ('owner@zeitgeist.demo',    'Alex Becker',     'owner',     v_koeln, null::uuid,     'full_time',  2400, '{"1":480,"2":480,"3":480,"4":480,"5":480,"6":0,"7":0}', 30, null::date,   false, null::int, 'Z-001', '{}'::int[]),
      ('admin@zeitgeist.demo',    'Sophie Wagner',   'admin',     v_koeln, null,           'full_time',  2400, '{"1":480,"2":480,"3":480,"4":480,"5":480,"6":0,"7":0}', 30, null,         false, null,      'Z-002', '{}'),
      ('teamlead@zeitgeist.demo', 'Jonas Hoffmann',  'team_lead', v_koeln, v_team_service, 'full_time',  2400, '{"1":480,"2":480,"3":480,"4":480,"5":480,"6":0,"7":0}', 28, null,         false, 2300,      'Z-003', '{}'),
      ('marvin@zeitgeist.demo',   'Marvin Julius',   'employee',  v_koeln, v_team_service, 'apprentice', 2400, '{"1":480,"2":480,"3":480,"4":480,"5":480,"6":0,"7":0}', 30, null,         false, 1150,      'Z-004', '{2}'),
      ('lena@zeitgeist.demo',     'Lena Schmidt',    'employee',  v_koeln, v_team_service, 'full_time',  2400, '{"1":480,"2":480,"3":480,"4":480,"5":480,"6":0,"7":0}', 28, null,         false, 1850,      'Z-005', '{}'),
      ('mehmet@zeitgeist.demo',   'Mehmet Yılmaz',   'employee',  v_koeln, v_team_service, 'part_time',  1200, '{"1":300,"2":300,"3":300,"4":300,"5":0,"6":0,"7":0}',   20, null,         false, 1600,      'Z-006', '{}'),
      ('anna@zeitgeist.demo',     'Anna Kowalski',   'employee',  v_koeln, v_team_service, 'full_time',  2400, '{"1":480,"2":480,"3":480,"4":480,"5":480,"6":0,"7":0}', 28, null,         true,  1900,      'Z-007', '{}'),
      ('tim@zeitgeist.demo',      'Tim Neumann',     'employee',  v_koeln, v_team_service, 'minijob',     540, '{"1":0,"2":0,"3":0,"4":0,"5":270,"6":270,"7":0}',       10, null,         false, 1390,      'Z-008', '{}'),
      ('sara@zeitgeist.demo',     'Sara Fischer',    'employee',  v_hh,    v_team_lager,   'full_time',  2400, '{"1":480,"2":480,"3":480,"4":480,"5":480,"6":0,"7":0}', 28, null,         false, 1750,      'Z-009', '{}'),
      ('lukas@zeitgeist.demo',    'Lukas Braun',     'employee',  v_hh,    v_team_lager,   'full_time',  2400, '{"1":480,"2":480,"3":480,"4":480,"5":480,"6":0,"7":0}', 28, null,         false, 1750,      'Z-010', '{}'),
      ('mia@zeitgeist.demo',      'Mia Richter',     'employee',  v_hh,    v_team_lager,   'minijob',     480, '{"1":0,"2":0,"3":240,"4":0,"5":0,"6":240,"7":0}',       10, null,         false, 1390,      'Z-011', '{}'),
      ('noah@zeitgeist.demo',     'Noah Klein',      'employee',  v_hh,    v_team_lager,   'apprentice', 2400, '{"1":480,"2":480,"3":480,"4":480,"5":480,"6":0,"7":0}', 30, '2009-08-20', false, 1050,      'Z-012', '{3}'),
      ('emilia@zeitgeist.demo',   'Emilia Wolf',     'employee',  v_hh,    v_team_lager,   'working_student', 1200, '{"1":480,"2":0,"3":480,"4":0,"5":240,"6":0,"7":0}', 20, null,     false, 1500,      'Z-013', '{}')
    ) as t(email, name, role, loc, team, ctype, weekly, targets, vacation, birth, mutter, wage, empno, school)
  loop
    v_uid := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', r.email, v_pw, now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', r.name), now(), now(),
      '', '', '', '', '', '', '', ''
    );

    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_uid, v_uid::text,
            jsonb_build_object('sub', v_uid::text, 'email', r.email, 'email_verified', true),
            'email', now(), now(), now());

    insert into public.memberships (org_id, user_id, role, status, display_name, email, location_id, team_id,
                                    employee_no, birth_date, maternity_protection)
    values (v_org, v_uid, r.role::public.member_role, 'active', r.name, r.email, r.loc, r.team,
            r.empno, r.birth, r.mutter)
    returning id into v_mid;

    insert into public.employment_contracts (membership_id, valid_from, type, weekly_minutes, daily_targets,
                                             vacation_days_per_year, school_days)
    values (v_mid, date '2025-01-01', r.ctype::public.contract_type, r.weekly, r.targets::jsonb, r.vacation, r.school);

    if r.wage is not null then
      insert into public.compensations (membership_id, valid_from, hourly_wage_cents)
      values (v_mid, date '2025-01-01', r.wage);
    end if;

    insert into public.vacation_entitlements (membership_id, year, days, carried_over)
    values (v_mid, 2026, r.vacation, case when r.ctype = 'full_time' then 3 else 0 end);

    if r.role = 'team_lead' then
      update public.teams set lead_membership_id = v_mid where id = v_team_service;
    end if;

    -- -------------------------------------------------------------------------
    -- 8 Wochen Historie (bis gestern). Heute bleibt offen für Live-Tests.
    -- -------------------------------------------------------------------------
    for d in select generate_series(v_today - 56, v_today - 1, interval '1 day')::date loop
      v_target := coalesce((r.targets::jsonb ->> extract(isodow from d)::text)::int, 0);
      continue when v_target = 0;
      continue when extract(isodow from d)::int = any (r.school);   -- Berufsschule
      continue when random() < 0.04;                                   -- gelegentlich frei/krank

      v_jitter := (random() * 50)::int - 20;
      v_in := (d + time '08:00' + make_interval(mins => v_jitter)) at time zone 'Europe/Berlin';

      if v_target <= 360 then
        -- kurze Schicht: Pause nur, wenn > 6 h nötig wäre – hier keine
        v_out := v_in + make_interval(mins => v_target + (random() * 20)::int - 5);
        insert into public.time_events (id, membership_id, kind, occurred_at, work_date, source) values
          (gen_random_uuid(), v_mid, 'check_in',  v_in,  d, 'terminal_qr'),
          (gen_random_uuid(), v_mid, 'check_out', v_out, d, 'terminal_qr');
      else
        v_break := case when random() < 0.85 then 30 + (random() * 15)::int else 20 end; -- teils zu kurz
        v_bs := v_in + make_interval(mins => 210 + (random() * 60)::int);
        v_be := v_bs + make_interval(mins => v_break);
        v_out := v_in + make_interval(mins => v_target + v_break + (random() * 50)::int - 15);

        -- Ein paar bewusste Verstöße für die Demo
        if r.email = 'lena@zeitgeist.demo' and d = v_today - 9 then
          v_out := v_in + interval '10 hours 40 minutes';               -- > 10 h (§ 3 ArbZG)
        end if;

        insert into public.time_events (id, membership_id, kind, occurred_at, work_date, source) values
          (gen_random_uuid(), v_mid, 'check_in',    v_in,  d, 'app'),
          (gen_random_uuid(), v_mid, 'break_start', v_bs,  d, 'app'),
          (gen_random_uuid(), v_mid, 'break_end',   v_be,  d, 'app'),
          (gen_random_uuid(), v_mid, 'check_out',   v_out, d, 'app');
      end if;
    end loop;
  end loop;

  -- ---------------------------------------------------------------------------
  -- Offene Anträge & Abwesenheiten
  -- ---------------------------------------------------------------------------
  insert into public.correction_requests (membership_id, work_date, kind, proposed, reason)
  select m.id, v_today - 3, 'missing_check_out',
         jsonb_build_array(jsonb_build_object('kind', 'check_out',
           'occurred_at', ((v_today - 3) + time '17:05') at time zone 'Europe/Berlin')),
         'Terminal war kurz offline, Ausstempeln vergessen.'
    from public.memberships m where m.email = 'lukas@zeitgeist.demo';

  insert into public.absences (membership_id, type_id, start_date, end_date, status, note)
  select m.id, t.id, v_today + 21, v_today + 32, 'pending', 'Familienurlaub'
    from public.memberships m, public.absence_types t
   where m.email = 'sara@zeitgeist.demo' and t.org_id = v_org and t.key = 'vacation';

  insert into public.absences (membership_id, type_id, start_date, end_date, status, reviewed_at)
  select m.id, t.id, v_today + 7, v_today + 11, 'approved', now()
    from public.memberships m, public.absence_types t
   where m.email = 'mehmet@zeitgeist.demo' and t.org_id = v_org and t.key = 'vacation';

  -- Vormonat abgeschlossen & gesperrt
  insert into public.month_closings (membership_id, month, employee_confirmed_at, locked_at)
  select m.id, date_trunc('month', v_today - interval '1 month')::date, now() - interval '10 days', now() - interval '8 days'
    from public.memberships m where m.org_id = v_org;
end
$seed$;
