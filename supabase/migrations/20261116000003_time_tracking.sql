-- =============================================================================
-- Zeitgeist · 0003 Zeiterfassung
-- time_events ist ein append-only Ereignis-Log und die einzige Quelle der Wahrheit.
-- work_days / compliance_violations sind abgeleitet und werden nur vom System
-- (SECURITY-DEFINER-Funktionen bzw. service_role) geschrieben.
-- =============================================================================

create table public.time_events (
  -- Vom Client erzeugte UUID → Offline-Sync ist idempotent
  id            uuid primary key,
  org_id        uuid not null references public.organizations (id) on delete restrict,
  membership_id uuid not null references public.memberships (id) on delete restrict,
  kind          public.time_event_kind not null,
  occurred_at   timestamptz not null,
  received_at   timestamptz not null default now(),
  -- Arbeitstag (Europe/Berlin) des zugehörigen Check-ins – auch über Mitternacht
  work_date     date not null,
  source        public.time_event_source not null,
  terminal_id   uuid references public.terminals (id) on delete restrict,
  project_id    uuid references public.projects (id) on delete restrict,
  -- Standort NUR beim Stempeln und nur mit Einwilligung
  geo_lat       double precision,
  geo_lng       double precision,
  geo_accuracy_m real,
  was_offline   boolean not null default false,
  note          text check (char_length(note) <= 500),
  created_by    uuid references auth.users (id) on delete set null,
  -- Korrekturen: neues Ereignis ersetzt altes, das alte wird ungültig markiert
  supersedes_id uuid references public.time_events (id) on delete restrict,
  voided_at     timestamptz,
  voided_by     uuid references auth.users (id) on delete set null,
  void_reason   text,
  check ((voided_at is null) = (void_reason is null))
);
create index time_events_member_time on public.time_events (membership_id, occurred_at);
create index time_events_org_date on public.time_events (org_id, work_date);

-- ---------------------------------------------------------------------------
-- Manipulationsschutz: kein DELETE, UPDATE nur zum einmaligen Ungültig-Markieren
-- ---------------------------------------------------------------------------
create or replace function app.guard_time_events()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Zeitbuchungen können nicht gelöscht werden (Erfassungspflicht).'
      using errcode = 'P0001';
  end if;

  if old.voided_at is not null then
    raise exception 'Ungültig markierte Buchungen sind unveränderlich.' using errcode = 'P0001';
  end if;

  if (to_jsonb(new) - array['voided_at','voided_by','void_reason'])
     is distinct from (to_jsonb(old) - array['voided_at','voided_by','void_reason']) then
    raise exception 'Zeitbuchungen sind unveränderlich. Bitte eine Korrektur anlegen.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger guard_time_events
  before update or delete on public.time_events
  for each row execute function app.guard_time_events();

-- ---------------------------------------------------------------------------
-- Abgeleitete Tageswerte
-- ---------------------------------------------------------------------------
create table public.work_days (
  org_id          uuid not null references public.organizations (id) on delete restrict,
  membership_id   uuid not null references public.memberships (id) on delete restrict,
  work_date       date not null,
  first_in        timestamptz,
  last_out        timestamptz,
  gross_minutes   int not null default 0,
  break_minutes   int not null default 0,
  net_minutes     int not null default 0,
  -- nach Rundung / automatischem Pausenabzug (Basis für Lohn & Stundenkonto)
  valued_minutes  int not null default 0,
  target_minutes  int not null default 0,
  surcharges      jsonb not null default '{}',
  status          text not null default 'open' check (status in ('open', 'complete', 'incomplete')),
  recomputed_at   timestamptz not null default now(),
  primary key (membership_id, work_date)
);
create index on public.work_days (org_id, work_date);

create table public.compliance_violations (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations (id) on delete restrict,
  membership_id   uuid not null references public.memberships (id) on delete restrict,
  work_date       date not null,
  code            text not null,           -- z. B. ARBZG_MAX_DAILY, ARBZG_BREAK, JARBSCHG_NIGHT
  severity        public.violation_severity not null,
  details         jsonb not null default '{}',
  detected_at     timestamptz not null default now(),
  acknowledged_by uuid references auth.users (id) on delete set null,
  acknowledged_at timestamptz,
  unique (membership_id, work_date, code)
);
create index on public.compliance_violations (org_id, work_date);

-- ---------------------------------------------------------------------------
-- Korrekturanträge
-- ---------------------------------------------------------------------------
create table public.correction_requests (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete restrict,
  membership_id uuid not null references public.memberships (id) on delete restrict,
  work_date     date not null,
  kind          text not null check (kind in ('missing_check_in', 'missing_check_out', 'wrong_time', 'missing_break', 'other')),
  -- Vorgeschlagene Ereignisse: [{kind, occurred_at, replaces_event_id?}]
  proposed      jsonb not null,
  reason        text not null check (char_length(reason) between 3 and 1000),
  status        public.request_status not null default 'pending',
  reviewed_by   uuid references auth.users (id) on delete set null,
  reviewed_at   timestamptz,
  review_note   text,
  created_at    timestamptz not null default now()
);
create index on public.correction_requests (org_id, status);

-- ---------------------------------------------------------------------------
-- Stundenkonto: manuelle Buchungen (Auszahlung, Übertrag, Korrektur)
-- ---------------------------------------------------------------------------
create table public.time_account_adjustments (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations (id) on delete restrict,
  membership_id  uuid not null references public.memberships (id) on delete restrict,
  minutes        int not null,
  reason         text not null check (reason in ('payout', 'carry_over', 'manual', 'cap')),
  note           text,
  effective_date date not null,
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Monatsabschluss
-- ---------------------------------------------------------------------------
create table public.month_closings (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references public.organizations (id) on delete restrict,
  membership_id         uuid not null references public.memberships (id) on delete restrict,
  month                 date not null check (extract(day from month) = 1),
  employee_confirmed_at timestamptz,
  locked_at             timestamptz,
  locked_by             uuid references auth.users (id) on delete set null,
  snapshot              jsonb,
  pdf_path              text,
  created_at            timestamptz not null default now(),
  unique (membership_id, month)
);
create index on public.month_closings (org_id, month);

-- Neue Buchungen in gesperrten Monaten nur über die Korrekturfunktion,
-- die vorher `zeitgeist.allow_locked = on` setzt (und protokolliert).
create or replace function app.guard_locked_month()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('zeitgeist.allow_locked', true), 'off') = 'on' then
    return new;
  end if;

  if exists (
    select 1 from public.month_closings mc
    where mc.membership_id = new.membership_id
      and mc.month = date_trunc('month', new.work_date)::date
      and mc.locked_at is not null
  ) then
    raise exception 'Der Monat % ist abgeschlossen. Änderungen nur per protokollierter Korrektur.',
      to_char(new.work_date, 'MM/YYYY') using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger guard_locked_month
  before insert or update on public.time_events
  for each row execute function app.guard_locked_month();
