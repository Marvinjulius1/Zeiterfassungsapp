-- =============================================================================
-- Zeitgeist · 0005 Personalakte, Benachrichtigungen, DSGVO, Audit-Log
-- =============================================================================

create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete restrict,
  membership_id uuid not null references public.memberships (id) on delete restrict,
  category      text not null check (category in ('contract', 'sick_note', 'certificate', 'payslip', 'other')),
  title         text not null,
  storage_path  text not null unique,
  mime_type     text,
  size_bytes    bigint,
  uploaded_by   uuid references auth.users (id) on delete set null,
  retain_until  date,
  archived_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index on public.documents (membership_id);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  org_id     uuid references public.organizations (id) on delete cascade,
  kind       text not null,
  title      text not null,
  body       text,
  payload    jsonb not null default '{}',
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);

create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create table public.data_requests (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete restrict,
  membership_id uuid not null references public.memberships (id) on delete restrict,
  kind          text not null check (kind in ('export', 'erasure')),
  status        text not null default 'pending' check (status in ('pending', 'processing', 'done', 'rejected')),
  file_path     text,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

-- =============================================================================
-- Audit-Log: append-only mit Hash-Kette je Firma
-- =============================================================================
create table public.audit_log (
  id          bigint generated always as identity primary key,
  org_id      uuid not null references public.organizations (id) on delete restrict,
  actor_id    uuid,          -- auth.uid() oder NULL bei System
  actor_kind  text not null check (actor_kind in ('user', 'system', 'terminal')),
  entity      text not null, -- Tabellenname
  entity_id   text not null,
  action      text not null check (action in ('insert', 'update', 'delete', 'void', 'lock', 'unlock', 'approve', 'reject', 'export', 'login')),
  old_value   jsonb,
  new_value   jsonb,
  reason      text,
  created_at  timestamptz not null default clock_timestamp(),
  prev_hash   text,
  hash        text not null
);
create index on public.audit_log (org_id, id desc);
create index on public.audit_log (org_id, entity, entity_id);

create or replace function app.audit_hash(r public.audit_log)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(
    concat_ws('|',
      coalesce(r.prev_hash, 'GENESIS'), r.id::text, r.org_id::text,
      coalesce(r.actor_id::text, ''), r.actor_kind, r.entity, r.entity_id, r.action,
      coalesce(r.old_value::text, ''), coalesce(r.new_value::text, ''),
      coalesce(r.reason, ''), to_char(r.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US')
    ), 'sha256'), 'hex');
$$;

create or replace function app.audit_chain()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Serialisiert Schreibvorgänge je Firma → lückenlose, eindeutige Kette
  perform pg_advisory_xact_lock(hashtextextended(new.org_id::text, 42));
  select a.hash into new.prev_hash
    from public.audit_log a
   where a.org_id = new.org_id
   order by a.id desc
   limit 1;
  new.hash := app.audit_hash(new);
  return new;
end;
$$;

create trigger audit_chain
  before insert on public.audit_log
  for each row execute function app.audit_chain();

create or replace function app.audit_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Das Audit-Log ist unveränderlich.' using errcode = 'P0001';
end;
$$;

create trigger audit_immutable
  before update or delete on public.audit_log
  for each row execute function app.audit_immutable();

create trigger audit_no_truncate
  before truncate on public.audit_log
  for each statement execute function app.audit_immutable();

-- Prüft die Kette einer Firma. Gibt die erste kaputte ID zurück (NULL = intakt).
create or replace function public.verify_audit_chain(p_org uuid)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r public.audit_log;
  expected_prev text := null;
begin
  if not app.is_org_admin(p_org) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  for r in select * from public.audit_log where org_id = p_org order by id loop
    if r.prev_hash is distinct from expected_prev or r.hash <> app.audit_hash(r) then
      return r.id;
    end if;
    expected_prev := r.hash;
  end loop;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Generischer Audit-Trigger für fachliche Tabellen
-- ---------------------------------------------------------------------------
create or replace function app.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_org uuid;
  v_action text := lower(tg_op);
  v_actor uuid := auth.uid();
begin
  v_org := case when tg_table_name = 'organizations'
                then (v_row ->> 'id')::uuid
                else (v_row ->> 'org_id')::uuid end;

  if tg_op = 'UPDATE' then
    -- Nur geänderte Felder protokollieren (kompakter, lesbarer)
    select jsonb_object_agg(k, v_old -> k), jsonb_object_agg(k, v_new -> k)
      into v_old, v_new
      from jsonb_object_keys(v_new) k
     where (v_new -> k) is distinct from (v_old -> k)
       and k not in ('updated_at', 'recomputed_at');
    if v_new is null then
      return null; -- keine relevante Änderung
    end if;
    if tg_table_name = 'time_events' and v_new ? 'voided_at' then
      v_action := 'void';
    end if;
  end if;

  insert into public.audit_log (org_id, actor_id, actor_kind, entity, entity_id, action, old_value, new_value, reason)
  values (
    v_org,
    v_actor,
    coalesce(nullif(current_setting('zeitgeist.actor_kind', true), ''),
             case when v_actor is null then 'system' else 'user' end),
    tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'membership_id' || ':' || coalesce(v_row ->> 'work_date', '')),
    v_action,
    v_old,
    v_new,
    app.current_reason()
  );
  return null;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'organizations','locations','teams','memberships','employment_contracts','compensations',
    'invitations','projects','rule_sets','terminals','geo_consents',
    'time_events','correction_requests','time_account_adjustments','month_closings',
    'absence_types','absences','vacation_entitlements','shifts','shift_swap_requests','shift_claims',
    'documents','data_requests'
  ] loop
    execute format(
      'create trigger audit_row after insert or update or delete on public.%I
         for each row execute function app.audit_row()', t);
  end loop;
end $$;
