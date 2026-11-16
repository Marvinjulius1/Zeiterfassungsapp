-- =============================================================================
-- Zeitgeist · Phase 3: Stempeln & Tageswerte
--
-- public.stamp()              einziger Weg, eine Zeitbuchung anzulegen (alle Erfassungswege)
-- app.recompute_work_day()    berechnet work_days aus dem Ereignis-Log
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tageswerte neu berechnen
-- ---------------------------------------------------------------------------
create or replace function app.recompute_work_day(p_membership uuid, p_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e record;
  v_org uuid;
  v_now timestamptz := now();
  v_in timestamptz;          -- Beginn des offenen Arbeitsblocks
  v_break timestamptz;       -- Beginn der offenen Pause
  v_first timestamptz;
  v_last timestamptz;
  v_gross int := 0;          -- Sekunden
  v_breaks int := 0;         -- Sekunden
  v_target int := 0;
  v_status text;
  v_count int := 0;
begin
  select org_id into v_org from public.memberships where id = p_membership;

  for e in
    select kind, occurred_at from public.time_events
     where membership_id = p_membership and work_date = p_date and voided_at is null
     order by occurred_at, received_at
  loop
    v_count := v_count + 1;
    case e.kind
      when 'check_in' then
        if v_in is null then
          v_in := e.occurred_at;
          v_first := coalesce(v_first, e.occurred_at);
        end if;
      when 'break_start' then
        if v_in is not null and v_break is null then
          v_break := e.occurred_at;
        end if;
      when 'break_end' then
        if v_break is not null then
          v_breaks := v_breaks + extract(epoch from e.occurred_at - v_break)::int;
          v_break := null;
        end if;
      when 'check_out' then
        if v_in is not null then
          if v_break is not null then -- Auschecken während der Pause beendet die Pause
            v_breaks := v_breaks + extract(epoch from e.occurred_at - v_break)::int;
            v_break := null;
          end if;
          v_gross := v_gross + extract(epoch from e.occurred_at - v_in)::int;
          v_last := e.occurred_at;
          v_in := null;
        end if;
    end case;
  end loop;

  -- Offener Block: bis jetzt zählen (Live-Stand)
  if v_in is not null then
    if v_break is not null then
      v_breaks := v_breaks + extract(epoch from v_now - v_break)::int;
    end if;
    v_gross := v_gross + extract(epoch from v_now - v_in)::int;
  end if;

  select coalesce((c.daily_targets ->> extract(isodow from p_date)::text)::int, 0)
    into v_target
    from public.employment_contracts c
   where c.membership_id = p_membership
     and p_date between c.valid_from and coalesce(c.valid_to, 'infinity'::date)
   limit 1;

  v_status := case
    when v_in is null then 'complete'
    when p_date < (v_now at time zone 'Europe/Berlin')::date - 1 then 'incomplete'
    else 'open'
  end;

  if v_count = 0 then
    delete from public.work_days where membership_id = p_membership and work_date = p_date;
    return;
  end if;

  insert into public.work_days as w (org_id, membership_id, work_date, first_in, last_out,
    gross_minutes, break_minutes, net_minutes, valued_minutes, target_minutes, status, recomputed_at)
  values (v_org, p_membership, p_date, v_first, v_last,
    v_gross / 60, v_breaks / 60, greatest(v_gross - v_breaks, 0) / 60,
    greatest(v_gross - v_breaks, 0) / 60,  -- Rundung/Auto-Pause folgen mit der Regel-Engine (Phase 4)
    coalesce(v_target, 0), v_status, v_now)
  on conflict (membership_id, work_date) do update set
    first_in = excluded.first_in, last_out = excluded.last_out,
    gross_minutes = excluded.gross_minutes, break_minutes = excluded.break_minutes,
    net_minutes = excluded.net_minutes, valued_minutes = excluded.valued_minutes,
    target_minutes = excluded.target_minutes, status = excluded.status,
    recomputed_at = excluded.recomputed_at;
end;
$$;

-- Tageswerte bei jeder Buchungsänderung automatisch aktualisieren
create or replace function app.on_time_event_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform app.recompute_work_day(new.membership_id, new.work_date);
  return null;
end;
$$;

create trigger recompute_work_day
  after insert or update on public.time_events
  for each row execute function app.on_time_event_change();

-- ---------------------------------------------------------------------------
-- Stempeln
-- ---------------------------------------------------------------------------
create or replace function public.stamp(
  p_membership_id uuid,
  p_event_id      uuid,
  p_kind          public.time_event_kind,
  p_source        public.time_event_source default 'app',
  -- Nur bei Offline-Buchungen wird die Gerätezeit übernommen (und markiert)
  p_offline       boolean default false,
  p_occurred_at   timestamptz default null,
  p_project_id    uuid default null,
  p_geo_lat       double precision default null,
  p_geo_lng       double precision default null,
  p_geo_accuracy  real default null,
  p_note          text default null
)
returns public.time_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.time_events;
  v_mem public.memberships;
  v_at timestamptz;
  v_last public.time_events;
  v_state text;
  v_work_date date;
  v_row public.time_events;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;

  select * into v_mem from public.memberships
   where id = p_membership_id and user_id = auth.uid() and status = 'active';
  if v_mem.id is null then
    raise exception 'Keine aktive Mitgliedschaft' using errcode = '42501';
  end if;

  -- Idempotenz: dieselbe Buchung (z. B. doppelter Offline-Sync) nur einmal
  select * into v_existing from public.time_events where id = p_event_id;
  if v_existing.id is not null then
    if v_existing.membership_id <> p_membership_id then
      raise exception 'Ungültige Buchungs-ID' using errcode = '42501';
    end if;
    return v_existing;
  end if;

  -- Zeitpunkt: online immer Serverzeit (manipulationssicher), offline Gerätezeit mit Grenzen
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

  -- Nichts darf nach dieser Buchung bereits existieren (Reihenfolge bleibt eindeutig)
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

  if not (
       (v_state = 'out'   and p_kind = 'check_in')
    or (v_state = 'in'    and p_kind in ('break_start', 'check_out'))
    or (v_state = 'break' and p_kind in ('break_end', 'check_out'))
  ) then
    raise exception '%', case v_state
      when 'out'   then 'Du bist nicht eingecheckt.'
      when 'in'    then 'Du bist bereits eingecheckt.'
      else              'Du bist gerade in der Pause.'
    end using errcode = 'P0001';
  end if;

  -- Arbeitstag = Datum des Check-ins (Nachtschichten bleiben einem Tag zugeordnet)
  if p_kind = 'check_in' then
    v_work_date := (v_at at time zone 'Europe/Berlin')::date;
  else
    select work_date into v_work_date from public.time_events
     where membership_id = p_membership_id and voided_at is null and kind = 'check_in' and occurred_at <= v_at
     order by occurred_at desc limit 1;
  end if;

  insert into public.time_events (id, org_id, membership_id, kind, occurred_at, work_date, source,
    project_id, geo_lat, geo_lng, geo_accuracy_m, was_offline, note, created_by)
  values (p_event_id, v_mem.org_id, p_membership_id, p_kind, v_at, v_work_date, p_source,
    p_project_id, p_geo_lat, p_geo_lng, p_geo_accuracy, p_offline and p_occurred_at is not null,
    nullif(trim(p_note), ''), auth.uid())
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.stamp from public, anon;
grant execute on function public.stamp to authenticated;
revoke execute on function app.recompute_work_day from public, anon, authenticated;

-- Bereits vorhandene Buchungen (z. B. Seed) einmal durchrechnen
do $$
declare r record;
begin
  for r in select distinct membership_id, work_date from public.time_events loop
    perform app.recompute_work_day(r.membership_id, r.work_date);
  end loop;
end $$;
