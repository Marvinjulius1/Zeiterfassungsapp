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
  -- Tage für bewusste Demo-Verstöße – immer passende Werktage, egal wann der Seed läuft
  v_lena_day  date;  -- > 10 h
  v_lukas_day date;  -- Spätschicht, am Folgetag zu früh → Ruhezeit
  v_noah_day  date;  -- Jugendlicher bis nach 20 Uhr
  v_lukas_forgot date; -- Lukas hat das Ausstempeln vergessen (Korrekturantrag)
begin
  select max(x)::date into v_lena_day  from generate_series(v_today - 14, v_today - 7, interval '1 day') x where extract(isodow from x) between 1 and 5;
  select max(x)::date into v_lukas_day from generate_series(v_today - 10, v_today - 3, interval '1 day') x where extract(isodow from x) between 1 and 4;
  select max(x)::date into v_noah_day  from generate_series(v_today - 8,  v_today - 2, interval '1 day') x where extract(isodow from x) in (1, 2, 4, 5);
  select max(x)::date into v_lukas_forgot from generate_series(v_today - 6, v_today - 2, interval '1 day') x
   where extract(isodow from x) between 1 and 5 and x::date not in (v_lukas_day, v_lukas_day + 1);

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
      continue when random() < 0.04 and d not in (v_lena_day, v_lukas_day, v_lukas_day + 1, v_noah_day, v_lukas_forgot); -- gelegentlich frei

      v_jitter := (random() * 50)::int - 20;
      v_in := (d + time '08:00' + make_interval(mins => v_jitter)) at time zone 'Europe/Berlin';

      if v_target <= 360 then
        -- kurze Schicht: keine Pause nötig
        v_out := v_in + make_interval(mins => v_target + (random() * 20)::int - 10);
        insert into public.time_events (id, membership_id, kind, occurred_at, received_at, work_date, source) values
          (gen_random_uuid(), v_mid, 'check_in',  v_in,  v_in,  d, 'terminal_qr'),
          (gen_random_uuid(), v_mid, 'check_out', v_out, v_out, d, 'terminal_qr');
      elsif r.birth is not null then
        -- Jugendliche (JArbSchG): 60 Min. Pause nach spätestens 4 h, max. 8 h
        v_break := 60 + (random() * 5)::int;
        v_bs := v_in + make_interval(mins => 225 + (random() * 40)::int);
        v_be := v_bs + make_interval(mins => v_break);
        v_out := v_in + make_interval(mins => v_target + v_break - (random() * 25)::int);
        if d = v_noah_day then  -- bewusster Verstoß: bis nach 20 Uhr (Nachtruhe)
          v_in := (d + time '12:00') at time zone 'Europe/Berlin';
          v_bs := v_in + interval '3 hours'; v_be := v_bs + interval '60 minutes';
          v_out := (d + time '20:40') at time zone 'Europe/Berlin';
        end if;
        insert into public.time_events (id, membership_id, kind, occurred_at, received_at, work_date, source) values
          (gen_random_uuid(), v_mid, 'check_in',    v_in,  v_in,  d, 'app'),
          (gen_random_uuid(), v_mid, 'break_start', v_bs,  v_bs,  d, 'app'),
          (gen_random_uuid(), v_mid, 'break_end',   v_be,  v_be,  d, 'app'),
          (gen_random_uuid(), v_mid, 'check_out',   v_out, v_out, d, 'app');
      else
        v_break := case when random() < 0.95 then 30 + (random() * 15)::int else 20 end; -- selten zu kurz
        v_bs := v_in + make_interval(mins => 210 + (random() * 60)::int);
        v_be := v_bs + make_interval(mins => v_break);
        v_out := v_in + make_interval(mins => v_target + v_break + (random() * 40)::int - 20);

        -- Bewusste Verstöße für die Demo
        if r.email = 'lena@zeitgeist.demo' and d = v_lena_day then
          v_out := v_in + interval '11 hours 15 minutes';               -- > 10 h netto (§ 3 ArbZG)
        end if;
        if r.email = 'lukas@zeitgeist.demo' and d = v_lukas_day then
          v_in := (d + time '13:30') at time zone 'Europe/Berlin';      -- Spätschicht …
          v_bs := v_in + interval '4 hours'; v_be := v_bs + interval '30 minutes';
          v_out := (d + time '22:45') at time zone 'Europe/Berlin';
        end if;
        if r.email = 'lukas@zeitgeist.demo' and d = v_lukas_day + 1 then
          v_in := (d + time '07:15') at time zone 'Europe/Berlin';      -- … früh rein: < 11 h Ruhezeit (§ 5 ArbZG)
          v_bs := v_in + interval '4 hours'; v_be := v_bs + interval '30 minutes';
          v_out := v_in + interval '8 hours 30 minutes';
        end if;

        insert into public.time_events (id, membership_id, kind, occurred_at, received_at, work_date, source) values
          (gen_random_uuid(), v_mid, 'check_in',    v_in,  v_in,  d, 'app'),
          (gen_random_uuid(), v_mid, 'break_start', v_bs,  v_bs,  d, 'app'),
          (gen_random_uuid(), v_mid, 'break_end',   v_be,  v_be,  d, 'app');
        if not (r.email = 'lukas@zeitgeist.demo' and d = v_lukas_forgot) then
          insert into public.time_events (id, membership_id, kind, occurred_at, received_at, work_date, source) values
            (gen_random_uuid(), v_mid, 'check_out', v_out, v_out, d, 'app');
        end if;
      end if;
    end loop;
  end loop;

  -- ---------------------------------------------------------------------------
  -- Heute: realistische Buchungen bis „jetzt" (für das Live-Board)
  -- Marvin & Noah bleiben frei, damit man selbst stempeln kann.
  -- ---------------------------------------------------------------------------
  for r in
    select m.id, m.email, c.daily_targets, c.school_days, row_number() over (order by m.email) as n
      from public.memberships m
      join public.employment_contracts c on c.membership_id = m.id
     where m.org_id = v_org
       and m.email not in ('marvin@zeitgeist.demo', 'noah@zeitgeist.demo', 'emilia@zeitgeist.demo')
  loop
    v_target := coalesce((r.daily_targets ->> extract(isodow from v_today)::text)::int, 0);
    continue when v_target = 0 or extract(isodow from v_today)::int = any (r.school_days);
    continue when r.n % 5 = 0;  -- ein paar sind noch nicht da
    v_in  := (v_today + time '07:45' + make_interval(mins => ((r.n * 7) % 30)::int)) at time zone 'Europe/Berlin';
    continue when v_in > now();
    insert into public.time_events (id, membership_id, kind, occurred_at, received_at, work_date, source)
      values (gen_random_uuid(), r.id, 'check_in', v_in, v_in, v_today, 'terminal_qr');
    v_bs := v_in + make_interval(mins => (240 + (r.n * 11) % 40)::int);
    if v_target > 360 and v_bs < now() then
      insert into public.time_events (id, membership_id, kind, occurred_at, received_at, work_date, source)
        values (gen_random_uuid(), r.id, 'break_start', v_bs, v_bs, v_today, 'app');
      v_be := v_bs + interval '30 minutes';
      if v_be < now() then
        insert into public.time_events (id, membership_id, kind, occurred_at, received_at, work_date, source)
          values (gen_random_uuid(), r.id, 'break_end', v_be, v_be, v_today, 'app');
      end if;
    end if;
    v_out := v_in + make_interval(mins => v_target + case when v_target > 360 then 30 else 0 end);
    if v_out < now() and v_be < now() then
      insert into public.time_events (id, membership_id, kind, occurred_at, received_at, work_date, source)
        values (gen_random_uuid(), r.id, 'check_out', v_out, v_out, v_today, 'terminal_qr');
    end if;
  end loop;

  -- Emilia ist heute krankgemeldet
  insert into public.absences (membership_id, type_id, start_date, end_date, status, reviewed_at)
  select m.id, t.id, v_today, v_today + 2, 'approved', now()
    from public.memberships m, public.absence_types t
   where m.email = 'emilia@zeitgeist.demo' and t.org_id = v_org and t.key = 'sick';

  -- ---------------------------------------------------------------------------
  -- Offene Anträge & Abwesenheiten
  -- ---------------------------------------------------------------------------
  insert into public.correction_requests (membership_id, work_date, kind, proposed, reason)
  select m.id, d.day, 'missing_check_out',
         jsonb_build_array(jsonb_build_object('kind', 'check_out',
           'occurred_at', (d.day + time '17:05') at time zone 'Europe/Berlin')),
         'Terminal war kurz offline, Ausstempeln vergessen.'
    from public.memberships m, (select v_lukas_forgot as day) d
   where m.email = 'lukas@zeitgeist.demo';

  insert into public.absences (membership_id, type_id, start_date, end_date, status, note)
  select m.id, t.id, v_today + 21, v_today + 32, 'pending', 'Familienurlaub'
    from public.memberships m, public.absence_types t
   where m.email = 'sara@zeitgeist.demo' and t.org_id = v_org and t.key = 'vacation';

  insert into public.absences (membership_id, type_id, start_date, end_date, status, reviewed_at)
  select m.id, t.id, v_today + 7, v_today + 11, 'approved', now()
    from public.memberships m, public.absence_types t
   where m.email = 'mehmet@zeitgeist.demo' and t.org_id = v_org and t.key = 'vacation';

  -- Veröffentlichte Schichten für die nächsten 14 Tage (inkl. heute) + 2 offene Schichten
  insert into public.shifts (org_id, location_id, membership_id, starts_at, ends_at, break_minutes, status)
  select v_org, m.location_id, m.id,
         (dd.sd + time '08:00') at time zone 'Europe/Berlin',
         (dd.sd + time '08:00' + make_interval(mins => t.mins + case when t.mins > 360 then 30 else 0 end)) at time zone 'Europe/Berlin',
         case when t.mins > 360 then 30 else 0 end,
         case when dd.sd >= v_today + 7 then 'draft' else 'published' end   -- nächste Woche noch Entwurf
    from public.memberships m
    join public.employment_contracts c on c.membership_id = m.id
    cross join lateral generate_series(v_today, v_today + 13, interval '1 day') g(day)
    cross join lateral (select g.day::date as sd) dd
    cross join lateral (select coalesce((c.daily_targets ->> extract(isodow from dd.sd)::text)::int, 0) as mins) t
   where m.org_id = v_org and t.mins > 0
     and not (extract(isodow from dd.sd)::int = any (c.school_days));

  insert into public.shifts (org_id, location_id, membership_id, starts_at, ends_at, break_minutes, position, status) values
    (v_org, v_koeln, null, ((v_today + 5) + time '10:00') at time zone 'Europe/Berlin', ((v_today + 5) + time '16:00') at time zone 'Europe/Berlin', 0, 'Service', 'published'),
    (v_org, v_hh,    null, ((v_today + 6) + time '07:00') at time zone 'Europe/Berlin', ((v_today + 6) + time '15:30') at time zone 'Europe/Berlin', 30, 'Lager', 'published');

  -- ---------------------------------------------------------------------------
  -- Terminals (Phase 6) – Demo-Kopplungscodes 111111 (Köln) / 222222 (Hamburg),
  -- Kiosk-PIN 246810. Demo-PINs nutzen den Entwicklungs-Pepper (nur lokal!).
  -- ---------------------------------------------------------------------------
  insert into public.terminals (id, org_id, location_id, name) values
    ('00000000-0000-4000-8000-0000000000a1', v_org, v_koeln, 'Eingang Köln'),
    ('00000000-0000-4000-8000-0000000000a2', v_org, v_hh,    'Eingang Hamburg');
  insert into public.terminal_secrets (terminal_id, kiosk_pin_hash, pairing_code_hash, pairing_expires_at)
  select t.id,
         encode(extensions.digest('kiosk:' || t.id || ':246810', 'sha256'), 'hex'),
         encode(extensions.digest(case when t.name like '%Köln' then '111111' else '222222' end, 'sha256'), 'hex'),
         now() + interval '30 days'
    from public.terminals t where t.org_id = v_org;

  update public.member_credentials c
     set pin_hash = encode(extensions.hmac('pin:' || v_org || ':' || x.pin, 'zeitgeist-dev-pepper-do-not-use-in-production', 'sha256'), 'hex')
    from (values ('marvin@zeitgeist.demo', '482915'), ('lena@zeitgeist.demo', '731406'), ('noah@zeitgeist.demo', '590327')) x(email, pin)
    join public.memberships m on m.email = x.email
   where c.membership_id = m.id;
  update public.member_credentials c
     set rfid_uid_hash = encode(extensions.hmac('rfid:' || v_org || ':04A2BC11', 'zeitgeist-dev-pepper-do-not-use-in-production', 'sha256'), 'hex')
    from public.memberships m where m.email = 'lena@zeitgeist.demo' and c.membership_id = m.id;

  -- Schichtbörse: Lena möchte die offene Kölner Schicht übernehmen
  insert into public.shift_claims (org_id, shift_id, membership_id)
  select v_org, s.id, m.id from public.shifts s, public.memberships m
   where s.org_id = v_org and s.membership_id is null and s.location_id = v_koeln and m.email = 'lena@zeitgeist.demo'
   limit 1;

  -- Schichttausch: Lukas → Sara, Sara hat schon zugestimmt (wartet auf Freigabe)
  insert into public.shift_swap_requests (org_id, shift_id, requester_id, target_membership_id, target_accepted_at)
  select v_org, s.id, s.membership_id, (select id from public.memberships where email = 'sara@zeitgeist.demo'), now()
    from public.shifts s join public.memberships m on m.id = s.membership_id
   where m.email = 'lukas@zeitgeist.demo' and s.status = 'published' and s.starts_at > now() + interval '1 day'
   order by s.starts_at limit 1;

  -- Vormonat abgeschlossen & gesperrt
  insert into public.month_closings (membership_id, month, employee_confirmed_at, locked_at)
  select m.id, date_trunc('month', v_today - interval '1 month')::date, now() - interval '10 days', now() - interval '8 days'
    from public.memberships m where m.org_id = v_org;
end
$seed$;
