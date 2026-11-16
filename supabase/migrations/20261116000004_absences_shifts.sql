-- =============================================================================
-- Zeitgeist · 0004 Abwesenheiten & Schichtplanung
-- =============================================================================

create table public.absence_types (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations (id) on delete restrict,
  key              text not null check (key in ('vacation','sick','child_sick','school','special','unpaid','comp_time','other')),
  label            text not null,
  counts_as_work   boolean not null default true,  -- zählt fürs Soll (z. B. Urlaub, Krank)
  deducts_vacation boolean not null default false,
  requires_approval boolean not null default true,
  requires_document boolean not null default false,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  unique (org_id, key)
);

create table public.absences (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations (id) on delete restrict,
  membership_id    uuid not null references public.memberships (id) on delete restrict,
  type_id          uuid not null references public.absence_types (id) on delete restrict,
  start_date       date not null,
  end_date         date not null,
  half_day_start   boolean not null default false,
  half_day_end     boolean not null default false,
  status           public.request_status not null default 'pending',
  note             text,
  attachment_path  text, -- z. B. AU-Foto im Storage
  substitute_membership_id uuid references public.memberships (id) on delete set null,
  reviewed_by      uuid references auth.users (id) on delete set null,
  reviewed_at      timestamptz,
  review_note      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (end_date >= start_date)
);
create index on public.absences (org_id, start_date);
create index on public.absences (membership_id, start_date);

create table public.vacation_entitlements (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete restrict,
  membership_id uuid not null references public.memberships (id) on delete restrict,
  year          int not null check (year between 2000 and 2100),
  days          numeric(4,1) not null,
  carried_over  numeric(4,1) not null default 0,
  carry_over_expires_on date,
  unique (membership_id, year)
);

-- ---------------------------------------------------------------------------
-- Schichten
-- ---------------------------------------------------------------------------
create table public.shift_templates (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete restrict,
  location_id   uuid references public.locations (id) on delete cascade,
  name          text not null,
  start_time    time not null,
  end_time      time not null,
  break_minutes int not null default 0 check (break_minutes >= 0),
  created_at    timestamptz not null default now()
);

create table public.shifts (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete restrict,
  location_id   uuid not null references public.locations (id) on delete restrict,
  -- NULL = offene Schicht in der Schichtbörse
  membership_id uuid references public.memberships (id) on delete set null,
  template_id   uuid references public.shift_templates (id) on delete set null,
  project_id    uuid references public.projects (id) on delete set null,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  break_minutes int not null default 0 check (break_minutes >= 0),
  position      text,
  note          text,
  status        text not null default 'draft' check (status in ('draft', 'published', 'cancelled')),
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index on public.shifts (org_id, starts_at);
create index on public.shifts (membership_id, starts_at);

create table public.shift_swap_requests (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references public.organizations (id) on delete restrict,
  shift_id             uuid not null references public.shifts (id) on delete cascade,
  requester_id         uuid not null references public.memberships (id) on delete cascade,
  target_membership_id uuid references public.memberships (id) on delete cascade,
  offered_shift_id     uuid references public.shifts (id) on delete set null,
  status               public.request_status not null default 'pending',
  target_accepted_at   timestamptz,
  decided_by           uuid references auth.users (id) on delete set null,
  decided_at           timestamptz,
  created_at           timestamptz not null default now()
);
create index on public.shift_swap_requests (org_id, status);

create table public.shift_claims (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete restrict,
  shift_id      uuid not null references public.shifts (id) on delete cascade,
  membership_id uuid not null references public.memberships (id) on delete cascade,
  status        public.request_status not null default 'pending',
  decided_by    uuid references auth.users (id) on delete set null,
  decided_at    timestamptz,
  created_at    timestamptz not null default now(),
  unique (shift_id, membership_id)
);

create trigger touch_updated_at before update on public.absences
  for each row execute function app.touch_updated_at();
create trigger touch_updated_at before update on public.shifts
  for each row execute function app.touch_updated_at();
