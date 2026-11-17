-- =============================================================================
-- Zeitgeist · Phase 6: Terminal-Modus & weitere Erfassungswege
--
-- Terminals haben KEIN Benutzerkonto. Sie werden per Kopplungscode verbunden und
-- erhalten ein Geräte-Token (nur als Hash gespeichert). Alle Terminal-Aktionen
-- laufen über den Next.js-Server mit service_role → public.terminal_stamp().
-- =============================================================================

alter table public.terminal_secrets
  add column device_token_hash text,
  add column paired_at timestamptz;

create unique index terminal_secrets_device_token on public.terminal_secrets (device_token_hash)
  where device_token_hash is not null;

-- PINs sind je Firma eindeutig (Lookup über HMAC-Hash, siehe src/features/terminal/crypto.ts)
create unique index member_credentials_pin_unique
  on public.member_credentials (org_id, pin_hash) where pin_hash is not null;

-- Fehlversuche je Terminal (Schutz gegen PIN-Raten)
create table public.terminal_auth_failures (
  id          bigint generated always as identity primary key,
  terminal_id uuid not null references public.terminals (id) on delete cascade,
  method      text not null,
  created_at  timestamptz not null default now()
);
create index on public.terminal_auth_failures (terminal_id, created_at desc);
alter table public.terminal_auth_failures enable row level security;
alter table public.terminal_auth_failures force row level security;
-- keine Policy: nur service_role

-- ---------------------------------------------------------------------------
-- Gemeinsamer Stempel-Kern (Zustandsautomat, Zeitregeln, Arbeitstag)
-- ---------------------------------------------------------------------------
create or replace function app.stamp_core(
  p_membership_id uuid,
  p_event_id      uuid,
  p_kind          public.time_event_kind,   -- NULL = automatisch (Kommen/Gehen/Pausenende)
  p_source        public.time_event_source,
  p_offline       boolean,
  p_occurred_at   timestamptz,
  p_terminal_id   uuid,
  p_project_id    uuid,
  p_geo_lat       double precision,
  p_geo_lng       double precision,
  p_geo_accuracy  real,
  p_note          text,
  p_created_by    uuid
)
returns public.time_events
language plpgsql security definer set search_path = ''
as $$
declare
  v_existing public.time_events;
  v_mem public.memberships;
  v_at timestamptz;
  v_last public.time_events;
  v_state text;
  v_kind public.time_event_kind := p_kind;
  v_work_date date;
  v_row public.time_events;
begin
  select * into v_mem from public.memberships where id = p_membership_id and status = 'active';
  if v_mem.id is null then
    raise exception 'Keine aktive Mitgliedschaft' using errcode = '42501';
  end if;

  -- Idempotenz
  select * into v_existing from public.time_events where id = p_event_id;
  if v_existing.id is not null then
    if v_existing.membership_id <> p_membership_id then
      raise exception 'Ungültige Buchungs-ID' using errcode = '42501';
    end if;
    return v_existing;
  end if;

  if p_offline and p_occurred_at is not null then
    if p_occurred_at > now() + interval '2 minutes' then
      raise exception 'Buchung liegt in der Zukunft.' using errcode = 'P0001';
    end if;
    if p_occurred_at < now() - interval '72 hours' then
      raise exception 'Offline-Buchung ist älter als 72 Stunden. Bitte Korrektur beantragen.' using errcode = 'P0001';
    end if;
    v_at := p_occurred_at;
  else
    v_at := now();
  end if;

  if exists (select 1 from public.time_events
              where membership_id = p_membership_id and voided_at is null and occurred_at > v_at) then
    raise exception 'Es gibt bereits eine spätere Buchung. Bitte Korrektur beantragen.' using errcode = 'P0001';
  end if;

  select * into v_last from public.time_events
   where membership_id = p_membership_id and voided_at is null and occurred_at <= v_at
   order by occurred_at desc, received_at desc limit 1;

  v_state := case
    when v_last.id is null or v_last.kind = 'check_out' then 'out'
    when v_last.kind = 'break_start' then 'break'
    else 'in'
  end;

  if v_kind is null then
    v_kind := case v_state when 'out' then 'check_in' when 'break' then 'break_end' else 'check_out' end;
  end if;

  if not (
       (v_state = 'out'   and v_kind = 'check_in')
    or (v_state = 'in'    and v_kind in ('break_start', 'check_out'))
    or (v_state = 'break' and v_kind in ('break_end', 'check_out'))
  ) then
    raise exception '%', case v_state
      when 'out'   then 'Du bist nicht eingecheckt.'
      when 'in'    then 'Du bist bereits eingecheckt.'
      else              'Du bist gerade in der Pause.'
    end using errcode = 'P0001';
  end if;

  if v_kind = 'check_in' then
    v_work_date := (v_at at time zone 'Europe/Berlin')::date;
  else
    select work_date into v_work_date from public.time_events
     where membership_id = p_membership_id and voided_at is null and kind = 'check_in' and occurred_at <= v_at
     order by occurred_at desc limit 1;
  end if;

  insert into public.time_events (id, org_id, membership_id, kind, occurred_at, work_date, source, terminal_id,
    project_id, geo_lat, geo_lng, geo_accuracy_m, was_offline, note, created_by)
  values (p_event_id, v_mem.org_id, p_membership_id, v_kind, v_at, v_work_date, p_source, p_terminal_id,
    p_project_id, p_geo_lat, p_geo_lng, p_geo_accuracy, p_offline and p_occurred_at is not null,
    nullif(trim(p_note), ''), p_created_by)
  returning * into v_row;

  return v_row;
end;
$$;
revoke execute on function app.stamp_core from public, anon, authenticated;

-- public.stamp (App) nutzt jetzt den gemeinsamen Kern
create or replace function public.stamp(
  p_membership_id uuid,
  p_event_id      uuid,
  p_kind          public.time_event_kind,
  p_source        public.time_event_source default 'app',
  p_offline       boolean default false,
  p_occurred_at   timestamptz default null,
  p_project_id    uuid default null,
  p_geo_lat       double precision default null,
  p_geo_lng       double precision default null,
  p_geo_accuracy  real default null,
  p_note          text default null
)
returns public.time_events
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;
  if not exists (select 1 from public.memberships
                  where id = p_membership_id and user_id = auth.uid() and status = 'active') then
    raise exception 'Keine aktive Mitgliedschaft' using errcode = '42501';
  end if;
  -- Die App darf nur „app" buchen; Terminal-Wege laufen über terminal_stamp
  if p_source <> 'app' then
    raise exception 'Ungültiger Erfassungsweg' using errcode = '42501';
  end if;
  -- Standort nur speichern, wenn eine aktive Einwilligung vorliegt (DSGVO)
  if p_geo_lat is not null and not exists (
       select 1 from public.geo_consents where membership_id = p_membership_id and revoked_at is null) then
    p_geo_lat := null; p_geo_lng := null; p_geo_accuracy := null;
  end if;
  return app.stamp_core(p_membership_id, p_event_id, p_kind, p_source, p_offline, p_occurred_at, null,
    p_project_id, p_geo_lat, p_geo_lng, p_geo_accuracy, p_note, auth.uid());
end;
$$;

-- Terminal-Stempel: nur der Server (service_role) nach Prüfung von Gerät + Identität
create or replace function public.terminal_stamp(
  p_terminal_id   uuid,
  p_membership_id uuid,
  p_event_id      uuid,
  p_source        public.time_event_source,
  p_kind          public.time_event_kind default null,   -- NULL = automatisch
  p_offline       boolean default false,
  p_occurred_at   timestamptz default null
)
returns public.time_events
language plpgsql security definer set search_path = ''
as $$
declare
  v_term public.terminals;
begin
  select * into v_term from public.terminals where id = p_terminal_id and revoked_at is null;
  if v_term.id is null then
    raise exception 'Terminal ist nicht (mehr) gekoppelt.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.memberships where id = p_membership_id and org_id = v_term.org_id and status = 'active') then
    raise exception 'Person gehört nicht zu dieser Firma.' using errcode = '42501';
  end if;
  if p_source not in ('terminal_qr', 'personal_qr', 'pin', 'rfid') then
    raise exception 'Ungültiger Erfassungsweg' using errcode = 'P0001';
  end if;
  perform set_config('zeitgeist.actor_kind', 'terminal', true);
  update public.terminals set last_seen_at = now() where id = p_terminal_id;
  return app.stamp_core(p_membership_id, p_event_id, p_kind, p_source, p_offline, p_occurred_at, p_terminal_id,
    null, null, null, null, null, null);
end;
$$;
revoke execute on function public.terminal_stamp from public, anon, authenticated;
grant execute on function public.terminal_stamp to service_role;

-- Aktueller Zustand einer Person (für Terminal und Scan-Seite)
create or replace function public.member_stamp_state(p_membership_id uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select case
    when e.kind is null or e.kind = 'check_out' then 'out'
    when e.kind = 'break_start' then 'break'
    else 'in' end
  from (select 1) x
  left join lateral (
    select kind from public.time_events
     where membership_id = p_membership_id and voided_at is null
     order by occurred_at desc, received_at desc limit 1) e on true;
$$;
revoke execute on function public.member_stamp_state from public, anon, authenticated;
grant execute on function public.member_stamp_state to service_role;
