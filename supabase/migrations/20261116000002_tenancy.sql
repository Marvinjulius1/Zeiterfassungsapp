-- =============================================================================
-- Zeitgeist · 0002 Mandanten, Personen, Verträge, Einladungen
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Firmen & Standorte
-- ---------------------------------------------------------------------------
create table public.organizations (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (char_length(name) between 2 and 120),
  slug              text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  default_state     public.german_state not null default 'NW',
  timezone          text not null default 'Europe/Berlin',
  -- § 16 Abs. 2 ArbZG: mindestens 2 Jahre Aufbewahrung
  retention_months  int  not null default 24 check (retention_months >= 24),
  has_works_council boolean not null default false,
  onboarding_completed_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.locations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete restrict,
  name        text not null check (char_length(name) between 1 and 120),
  address     text,
  state       public.german_state not null,
  timezone    text not null default 'Europe/Berlin',
  geofence_lat      double precision,
  geofence_lng      double precision,
  geofence_radius_m int check (geofence_radius_m between 25 and 5000),
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint geofence_complete check (
    (geofence_lat is null and geofence_lng is null and geofence_radius_m is null)
    or (geofence_lat is not null and geofence_lng is not null and geofence_radius_m is not null)
  )
);
create index on public.locations (org_id);

-- ---------------------------------------------------------------------------
-- Profile (1:1 zu auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  avatar_path text,
  locale      text not null default 'de' check (locale in ('de', 'en')),
  theme       text not null default 'dark' check (theme in ('dark', 'light', 'system')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

-- ---------------------------------------------------------------------------
-- Teams (Organigramm über parent_team_id)
-- ---------------------------------------------------------------------------
create table public.teams (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations (id) on delete restrict,
  location_id    uuid references public.locations (id) on delete set null,
  parent_team_id uuid references public.teams (id) on delete set null,
  name           text not null,
  lead_membership_id uuid, -- FK unten, da memberships später angelegt wird
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index on public.teams (org_id);

-- ---------------------------------------------------------------------------
-- Mitgliedschaften (Person ↔ Firma)
-- ---------------------------------------------------------------------------
create table public.memberships (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete restrict,
  user_id       uuid references auth.users (id) on delete set null,
  role          public.member_role not null default 'employee',
  status        public.member_status not null default 'invited',
  display_name  text not null,
  email         text,
  location_id   uuid references public.locations (id) on delete set null,
  team_id       uuid references public.teams (id) on delete set null,
  employee_no   text,
  -- Nur für Jugendarbeitsschutz nötig (Datenminimierung: kein Pflichtfeld)
  birth_date    date,
  maternity_protection boolean not null default false,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (org_id, user_id),
  unique (org_id, employee_no)
);
create index on public.memberships (org_id, status);
create index on public.memberships (user_id);
create index on public.memberships (team_id);

alter table public.teams
  add constraint teams_lead_fk foreign key (lead_membership_id)
  references public.memberships (id) on delete set null;

-- Stempel-Geheimnisse liegen getrennt und sind per RLS für niemanden lesbar.
-- Zugriff ausschließlich über SECURITY-DEFINER-Funktionen (Terminal, Stempeln).
create table public.member_credentials (
  membership_id      uuid primary key references public.memberships (id) on delete cascade,
  org_id             uuid not null references public.organizations (id) on delete restrict,
  pin_hash           text,
  personal_qr_secret text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  rfid_uid_hash      text,
  updated_at         timestamptz not null default now()
);
create unique index member_credentials_rfid_unique
  on public.member_credentials (org_id, rfid_uid_hash) where rfid_uid_hash is not null;

-- ---------------------------------------------------------------------------
-- Arbeitsverträge (zeitlich versioniert, keine Überschneidungen)
-- ---------------------------------------------------------------------------
create table public.employment_contracts (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations (id) on delete restrict,
  membership_id    uuid not null references public.memberships (id) on delete restrict,
  valid_from       date not null,
  valid_to         date,
  type             public.contract_type not null,
  weekly_minutes   int not null check (weekly_minutes between 0 and 3600),
  -- Soll-Minuten je Wochentag, ISO: 1 = Montag … 7 = Sonntag
  daily_targets    jsonb not null default '{"1":480,"2":480,"3":480,"4":480,"5":480,"6":0,"7":0}',
  vacation_days_per_year numeric(4,1) not null default 25 check (vacation_days_per_year >= 0),
  -- Berufsschultage (ISO-Wochentage) für Azubis
  school_days      int[] not null default '{}',
  trust_based_hours boolean not null default false, -- Vertrauensarbeitszeit
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (valid_to is null or valid_to >= valid_from),
  exclude using gist (
    membership_id with =,
    daterange(valid_from, coalesce(valid_to, 'infinity'::date), '[]') with &&
  )
);
create index on public.employment_contracts (org_id);

-- Vergütung separat: nur Admin + Person selbst (für MiLoG-Doku/Export).
create table public.compensations (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations (id) on delete restrict,
  membership_id    uuid not null references public.memberships (id) on delete restrict,
  valid_from       date not null,
  hourly_wage_cents int check (hourly_wage_cents >= 0),
  monthly_salary_cents int check (monthly_salary_cents >= 0),
  created_at       timestamptz not null default now(),
  unique (membership_id, valid_from)
);

-- ---------------------------------------------------------------------------
-- Einladungen (Link / QR / E-Mail)
-- ---------------------------------------------------------------------------
create table public.invitations (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  membership_id uuid not null references public.memberships (id) on delete cascade,
  token_hash    text not null unique,
  created_by    uuid references auth.users (id) on delete set null,
  expires_at    timestamptz not null default now() + interval '14 days',
  accepted_at   timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index on public.invitations (org_id);

-- ---------------------------------------------------------------------------
-- Projekte / Kostenstellen
-- ---------------------------------------------------------------------------
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete restrict,
  name        text not null,
  cost_center text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on public.projects (org_id);

-- ---------------------------------------------------------------------------
-- Regelwerke (Firma → Standort → Person, spätere Ebenen überschreiben)
-- ---------------------------------------------------------------------------
create table public.rule_sets (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete restrict,
  scope      public.rule_scope not null,
  scope_id   uuid not null, -- org.id | location.id | membership.id
  settings   jsonb not null default '{}',
  version    int not null default 1,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scope, scope_id)
);
create index on public.rule_sets (org_id);

-- ---------------------------------------------------------------------------
-- Terminals (Kiosk-Tablets)
-- ---------------------------------------------------------------------------
create table public.terminals (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations (id) on delete restrict,
  location_id     uuid not null references public.locations (id) on delete restrict,
  name            text not null,
  allowed_methods public.time_event_source[] not null default '{terminal_qr,personal_qr,pin,rfid}',
  last_seen_at    timestamptz,
  revoked_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.terminals (org_id);

-- Signatur-Schlüssel und Kiosk-PIN: für niemanden per RLS lesbar.
create table public.terminal_secrets (
  terminal_id    uuid primary key references public.terminals (id) on delete cascade,
  signing_secret text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  kiosk_pin_hash text,
  pairing_code_hash text,
  pairing_expires_at timestamptz,
  rotated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- DSGVO: Einwilligung zur Standortprüfung beim Stempeln
-- ---------------------------------------------------------------------------
create table public.geo_consents (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete restrict,
  membership_id uuid not null references public.memberships (id) on delete cascade,
  text_version  text not null,
  granted_at    timestamptz not null default now(),
  revoked_at    timestamptz
);
create index on public.geo_consents (membership_id);

-- ---------------------------------------------------------------------------
-- updated_at-Trigger
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'organizations','locations','profiles','teams','memberships',
    'employment_contracts','projects','rule_sets','terminals'
  ] loop
    execute format(
      'create trigger touch_updated_at before update on public.%I
         for each row execute function app.touch_updated_at()', t);
  end loop;
end $$;
